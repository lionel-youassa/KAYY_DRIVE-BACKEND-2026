import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { GoogleAuthService } from './google-auth.service';
import { getJwtSecret } from './jwt-secret';
import * as bcrypt from 'bcrypt';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto';

export type UserRole = 'user' | 'admin';

const DUMMY_PASSWORD_HASH =
  '$2b$12$6y3TLK5a3Thh5kKZvVoXzu//e0.bcJE1Ay/5rg9UFqssoitx4xemi';

export interface UserProfile {
  uid: string;
  email: string;
  pendingEmail?: string;
  nom: string;
  prenom: string;
  telephone?: string;
  photoUrl?: string;
  role: UserRole;
  dateCreation: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  provider: 'local' | 'google';
  hasPassword: boolean;
}

export interface AuthTokens {
  token: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

export interface LoginResponse {
  token: string;
  accessToken?: string;
  refreshToken?: string;
  user: UserProfile;
}

export interface RegisterResult {
  requiresEmailVerification: boolean;
  email: string;
  emailSent: boolean;
  message: string;
}

export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  challengeToken: string;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  message: string;
}

interface RefreshMeta {
  userAgent?: string;
  ip?: string;
}

interface ChallengePayload {
  sub: string;
  email: string;
  purpose: '2fa';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly emailVerificationRequired =
    process.env.AUTH_EMAIL_VERIFICATION_REQUIRED !== 'false';
  private readonly twoFactorRequired =
    process.env.AUTH_2FA_REQUIRED !== 'false';
  private readonly codeTtlMinutes = this.readInt('AUTH_CODE_TTL_MINUTES', 10);
  private readonly maxCodeAttempts = this.readInt('AUTH_CODE_MAX_ATTEMPTS', 5);
  private readonly resendSeconds = this.readInt('AUTH_CODE_RESEND_SECONDS', 60);
  private readonly accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  private readonly refreshExpiresIn =
    process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  private readonly otpPepper =
    process.env.AUTH_OTP_PEPPER?.trim() || getJwtSecret();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  async createUser(input: {
    email: string;
    password: string;
    nom: string;
    prenom?: string;
    telephone?: string;
  }): Promise<RegisterResult> {
    const email = this.normalizeEmail(input.email);

    const existingUser = await this.prisma.utilisateur.findFirst({
      where: {
        OR: [{ email }, { pendingEmail: email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const emailVerified = !this.emailVerificationRequired;

    const utilisateur = await this.prisma.utilisateur.create({
      data: {
        pseudo: input.nom,
        prenom: input.prenom || '',
        email,
        passwordHash,
        telephone: input.telephone,
        role: 'user',
        scoreReputation: 0,
        dateCreation: new Date(),
        emailVerified,
        twoFactorEnabled: this.twoFactorRequired,
      },
    });

    if (emailVerified) {
      return {
        requiresEmailVerification: false,
        email,
        emailSent: false,
        message: 'Compte créé. Vous pouvez maintenant vous connecter.',
      };
    }

    const emailSent = await this.sendEmailVerificationCode(utilisateur);

    return {
      requiresEmailVerification: true,
      email,
      emailSent,
      message: emailSent
        ? 'Un code de vérification a été envoyé à votre adresse e-mail.'
        : 'Compte créé, mais l’envoi de l’e-mail a échoué. Utilisez « Renvoyer le code ».',
    };
  }

  async verifyEmail(
    rawEmail: string,
    code: string,
  ): Promise<{ verified: true; message: string }> {
    const email = this.normalizeEmail(rawEmail);
    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: {
        OR: [{ email }, { pendingEmail: email }],
      },
    });

    if (!utilisateur) {
      throw new BadRequestException({
        code: 'INVALID_CODE',
        message: 'Code invalide ou expiré.',
      });
    }

    const isPendingEmail =
      utilisateur.pendingEmail === email && utilisateur.email !== email;

    if (!isPendingEmail && utilisateur.emailVerified) {
      return {
        verified: true,
        message: 'Votre adresse e-mail est vérifiée.',
      };
    }

    await this.assertAndConsumeCode({
      storedHash: utilisateur.emailVerificationCodeHash,
      expiresAt: utilisateur.emailVerificationExpiresAt,
      attempts: utilisateur.emailVerificationAttempts,
      email,
      purpose: 'email-verification',
      code,
      onInvalidAttempt: async (attempts) => {
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: { emailVerificationAttempts: attempts },
        });
      },
      onLocked: async () => {
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: {
            emailVerificationCodeHash: null,
            emailVerificationExpiresAt: null,
            emailVerificationAttempts: 0,
          },
        });
      },
    });

    if (isPendingEmail) {
      const emailOwner = await this.prisma.utilisateur.findUnique({
        where: { email },
      });

      if (emailOwner && emailOwner.id !== utilisateur.id) {
        throw new ConflictException(
          'Cette adresse e-mail vient d’être utilisée par un autre compte.',
        );
      }
    }

    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        ...(isPendingEmail ? { email, pendingEmail: null } : {}),
        emailVerified: true,
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationAttempts: 0,
      },
    });

    return {
      verified: true,
      message: 'Votre adresse e-mail est vérifiée.',
    };
  }

  async resendVerification(rawEmail: string): Promise<{
    success: true;
    resendAfterSeconds: number;
    message: string;
  }> {
    const email = this.normalizeEmail(rawEmail);
    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: {
        OR: [{ email }, { pendingEmail: email }],
      },
    });

    const hasPendingEmail = Boolean(utilisateur?.pendingEmail);

    if (utilisateur && (hasPendingEmail || !utilisateur.emailVerified)) {
      const remaining = this.remainingCooldown(
        utilisateur.emailVerificationLastSentAt,
      );

      if (remaining === 0) {
        await this.sendEmailVerificationCode(utilisateur);
      }
    }

    return {
      success: true,
      resendAfterSeconds: this.resendSeconds,
      message:
        'Si un compte non vérifié existe avec cet e-mail, un nouveau code a été envoyé.',
    };
  }

  async login(
    rawEmail: string,
    password: string,
    meta: RefreshMeta = {},
  ): Promise<LoginResponse | TwoFactorChallenge> {
    const email = this.normalizeEmail(rawEmail);
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (!utilisateur) {
      await this.compareDummyPassword(password);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants invalides',
      });
    }

    if (!utilisateur.passwordHash) {
      await this.compareDummyPassword(password);

      if (utilisateur.googleId) {
        throw new UnauthorizedException({
          code: 'USE_GOOGLE',
          message:
            'Ce compte utilise la connexion Google. Continuez avec Google.',
        });
      }

      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants invalides',
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      utilisateur.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiants invalides',
      });
    }

    if (this.emailVerificationRequired && !utilisateur.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        email,
        message: 'Vérifiez votre adresse e-mail avant de vous connecter.',
      });
    }

    if (this.twoFactorRequired && utilisateur.twoFactorEnabled) {
      return this.createTwoFactorChallenge(utilisateur);
    }

    return this.completeLogin(utilisateur, meta);
  }

  async verifyTwoFactor(
    challengeToken: string,
    code: string,
    meta: RefreshMeta = {},
  ): Promise<AuthTokens> {
    const payload = this.verifyChallengeToken(challengeToken);
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
    });

    if (!utilisateur || !utilisateur.twoFactorEnabled) {
      throw new UnauthorizedException({
        code: 'INVALID_CHALLENGE',
        message: 'Session de vérification invalide.',
      });
    }

    await this.assertAndConsumeCode({
      storedHash: utilisateur.twoFactorCodeHash,
      expiresAt: utilisateur.twoFactorExpiresAt,
      attempts: utilisateur.twoFactorAttempts,
      email: utilisateur.email,
      purpose: 'two-factor',
      code,
      onInvalidAttempt: async (attempts) => {
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: { twoFactorAttempts: attempts },
        });
      },
      onLocked: async () => {
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: {
            twoFactorCodeHash: null,
            twoFactorExpiresAt: null,
            twoFactorAttempts: 0,
          },
        });
      },
    });

    const updated = await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        twoFactorCodeHash: null,
        twoFactorExpiresAt: null,
        twoFactorAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    return this.issueTokens(updated, meta);
  }

  async resendTwoFactor(challengeToken: string): Promise<{
    success: true;
    emailSent: boolean;
    resendAfterSeconds: number;
    message: string;
  }> {
    const payload = this.verifyChallengeToken(challengeToken);
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
    });

    if (!utilisateur || !utilisateur.twoFactorEnabled) {
      throw new UnauthorizedException({
        code: 'INVALID_CHALLENGE',
        message: 'Session de vérification invalide.',
      });
    }

    const remaining = this.remainingCooldown(utilisateur.twoFactorLastSentAt);
    if (remaining > 0) {
      return {
        success: true,
        emailSent: false,
        resendAfterSeconds: remaining,
        message: 'Un code a déjà été envoyé récemment.',
      };
    }

    await this.sendTwoFactorCode(utilisateur);

    return {
      success: true,
      emailSent: true,
      resendAfterSeconds: this.resendSeconds,
      message: 'Un nouveau code de connexion a été envoyé.',
    };
  }

  async googleLogin(
    idToken: string,
    meta: RefreshMeta = {},
  ): Promise<AuthTokens> {
    const identity = await this.googleAuthService.verifyIdToken(idToken);
    const email = this.normalizeEmail(identity.email);

    let utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (!utilisateur) {
      utilisateur = await this.prisma.utilisateur.findUnique({
        where: { pendingEmail: email },
      });
    }

    if (utilisateur) {
      if (utilisateur.googleId && utilisateur.googleId !== identity.googleId) {
        throw new ConflictException(
          'Cette adresse e-mail est déjà liée à un autre compte Google.',
        );
      }

      utilisateur = await this.prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          email,
          pendingEmail: null,
          googleId: identity.googleId,
          emailVerified: true,
          emailVerificationCodeHash: null,
          emailVerificationExpiresAt: null,
          emailVerificationAttempts: 0,
          lastLoginAt: new Date(),
          photoUrl: utilisateur.photoUrl || identity.picture,
        },
      });
    } else {
      const pseudo =
        identity.familyName?.trim() ||
        identity.name?.trim() ||
        email.split('@')[0] ||
        'Utilisateur';

      utilisateur = await this.prisma.utilisateur.create({
        data: {
          pseudo,
          prenom: identity.givenName || '',
          email,
          googleId: identity.googleId,
          emailVerified: true,
          twoFactorEnabled: false,
          passwordHash: null,
          photoUrl: identity.picture,
          role: 'user',
          scoreReputation: 0,
          dateCreation: new Date(),
          lastLoginAt: new Date(),
        },
      });
    }

    return this.issueTokens(utilisateur, meta);
  }

  async refresh(
    refreshToken: string,
    meta: RefreshMeta = {},
  ): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { utilisateur: true },
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Session expirée. Reconnectez-vous.',
      });
    }

    if (stored.revokedAt) {
      await this.revokeAllRefreshTokens(stored.utilisateurId);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message:
          'Cette session a été révoquée pour des raisons de sécurité. Reconnectez-vous.',
      });
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Session expirée. Reconnectez-vous.',
      });
    }

    const newRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashToken(newRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + this.parseDurationMs(this.refreshExpiresIn, 30 * 86400000),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: newTokenHash,
        },
      });

      if (result.count === 0) {
        return false;
      }

      await tx.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          utilisateurId: stored.utilisateurId,
          expiresAt: newExpiresAt,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      });

      return true;
    });

    if (!updated) {
      await this.revokeAllRefreshTokens(stored.utilisateurId);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message:
          'Cette session a été révoquée pour des raisons de sécurité. Reconnectez-vous.',
      });
    }

    const accessToken = this.signAccessToken(stored.utilisateur);

    return {
      token: accessToken,
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: Math.floor(
        this.parseDurationMs(this.accessExpiresIn, 15 * 60000) / 1000,
      ),
      user: this.toProfile(stored.utilisateur),
    };
  }

  async logout(refreshToken?: string): Promise<{ success: true }> {
    if (!refreshToken) {
      return { success: true };
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async forgotPassword(
    rawEmail: string,
  ): Promise<{ success: true; message: string }> {
    const email = this.normalizeEmail(rawEmail);
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    const genericMessage =
      'Si un compte existe avec cet e-mail, un code de réinitialisation a été envoyé.';

    if (!utilisateur || !utilisateur.passwordHash) {
      return { success: true, message: genericMessage };
    }

    const remaining = this.remainingCooldown(
      utilisateur.passwordResetLastSentAt,
    );

    if (remaining === 0) {
      const code = this.generateCode();

      await this.prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          passwordResetCodeHash: this.hashCode(email, 'password-reset', code),
          passwordResetExpiresAt: this.codeExpiry(),
          passwordResetAttempts: 0,
          passwordResetLastSentAt: new Date(),
        },
      });

      const emailSent = await this.trySendEmail(() =>
        this.emailService.sendPasswordResetCode(
          email,
          code,
          this.codeTtlMinutes,
        ),
      );

      if (!emailSent) {
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: {
            passwordResetCodeHash: null,
            passwordResetExpiresAt: null,
            passwordResetAttempts: 0,
            passwordResetLastSentAt: null,
          },
        });
      }
    }

    return { success: true, message: genericMessage };
  }

  async resetPassword(
    rawEmail: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: true; message: string }> {
    const email = this.normalizeEmail(rawEmail);
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (!utilisateur) {
      throw new BadRequestException({
        code: 'INVALID_CODE',
        message: 'Code invalide ou expiré.',
      });
    }

    await this.assertAndConsumeCode({
      storedHash: utilisateur.passwordResetCodeHash,
      expiresAt: utilisateur.passwordResetExpiresAt,
      attempts: utilisateur.passwordResetAttempts,
      email,
      purpose: 'password-reset',
      code,
      onInvalidAttempt: async (attempts) => {
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: { passwordResetAttempts: attempts },
        });
      },
      onLocked: async () => {
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: {
            passwordResetCodeHash: null,
            passwordResetExpiresAt: null,
            passwordResetAttempts: 0,
          },
        });
      },
    });

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          passwordHash,
          emailVerified: true,
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { utilisateurId: utilisateur.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès.',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email: this.normalizeEmail(email) },
    });

    if (!utilisateur || !utilisateur.passwordHash) {
      return null;
    }

    if (this.emailVerificationRequired && !utilisateur.emailVerified) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      utilisateur.passwordHash,
    );

    if (!isPasswordValid) {
      return null;
    }

    const { passwordHash, ...result } = utilisateur;
    return result;
  }

  async checkUserExists(email: string): Promise<boolean> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    return !!user;
  }

  async setUserRole(uid: string, role: UserRole): Promise<void> {
    await this.prisma.utilisateur.update({
      where: { id: uid },
      data: { role },
    });
  }

  async getUserProfile(uid: string): Promise<UserProfile> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: uid },
    });

    if (!utilisateur) {
      throw new NotFoundException('Profil introuvable');
    }

    return this.toProfile(utilisateur);
  }

  async updateProfile(
    uid: string,
    updateData: {
      nom?: string;
      prenom?: string;
      email?: string;
      telephone?: string;
      currentPassword?: string;
    },
  ): Promise<UserProfile> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: uid },
    });

    if (!utilisateur) {
      throw new NotFoundException('Profil introuvable');
    }

    const updatePayload: {
      pseudo?: string;
      prenom?: string;
      email?: string;
      pendingEmail?: string | null;
      telephone?: string;
      emailVerified?: boolean;
      emailVerificationCodeHash?: string | null;
      emailVerificationExpiresAt?: Date | null;
      emailVerificationAttempts?: number;
      emailVerificationLastSentAt?: Date | null;
    } = {};

    if (updateData.nom) {
      updatePayload.pseudo = updateData.nom;
    }

    if (updateData.prenom !== undefined) {
      updatePayload.prenom = updateData.prenom;
    }

    if (updateData.telephone !== undefined) {
      updatePayload.telephone = updateData.telephone;
    }

    if (updateData.email) {
      const email = this.normalizeEmail(updateData.email);

      if (email === utilisateur.email && utilisateur.pendingEmail) {
        updatePayload.pendingEmail = null;
        updatePayload.emailVerificationCodeHash = null;
        updatePayload.emailVerificationExpiresAt = null;
        updatePayload.emailVerificationAttempts = 0;
        updatePayload.emailVerificationLastSentAt = null;
      } else if (
        email !== utilisateur.email &&
        email !== utilisateur.pendingEmail
      ) {
        if (utilisateur.googleId) {
          throw new BadRequestException(
            'Votre adresse e-mail est gérée par Google. Modifiez-la depuis votre compte Google.',
          );
        }

        if (!updateData.currentPassword || !utilisateur.passwordHash) {
          throw new UnauthorizedException(
            'Votre mot de passe actuel est requis pour changer d’adresse e-mail.',
          );
        }

        const isPasswordValid = await bcrypt.compare(
          updateData.currentPassword,
          utilisateur.passwordHash,
        );

        if (!isPasswordValid) {
          throw new UnauthorizedException('Mot de passe actuel incorrect.');
        }

        const existingUser = await this.prisma.utilisateur.findUnique({
          where: { email },
        });

        if (existingUser && existingUser.id !== uid) {
          throw new ConflictException('Cet email est déjà utilisé');
        }

        const pendingOwner = await this.prisma.utilisateur.findUnique({
          where: { pendingEmail: email },
        });

        if (pendingOwner && pendingOwner.id !== uid) {
          throw new ConflictException('Cet email est déjà utilisé');
        }

        if (this.emailVerificationRequired) {
          updatePayload.pendingEmail = email;
        } else {
          updatePayload.email = email;
          updatePayload.pendingEmail = null;
          updatePayload.emailVerified = true;
        }

        updatePayload.emailVerificationCodeHash = null;
        updatePayload.emailVerificationExpiresAt = null;
        updatePayload.emailVerificationAttempts = 0;
        updatePayload.emailVerificationLastSentAt = null;
      }
    }

    const updatedUser = await this.prisma.utilisateur.update({
      where: { id: uid },
      data: updatePayload,
    });

    if (updatePayload.pendingEmail && this.emailVerificationRequired) {
      await this.sendEmailVerificationCode(updatedUser);
    }

    return this.toProfile(updatedUser);
  }

  async changePassword(
    uid: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: uid },
    });

    if (!utilisateur || !utilisateur.passwordHash) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      utilisateur.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("L'ancien mot de passe est incorrect");
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.utilisateur.update({
        where: { id: uid },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { utilisateurId: uid, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async updatePhoto(uid: string, photoUrl: string): Promise<UserProfile> {
    const updatedUser = await this.prisma.utilisateur.update({
      where: { id: uid },
      data: { photoUrl },
    });

    return this.toProfile(updatedUser);
  }

  private async completeLogin(
    utilisateur: any,
    meta: RefreshMeta,
  ): Promise<AuthTokens> {
    const updated = await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(updated, meta);
  }

  private async createTwoFactorChallenge(
    utilisateur: any,
  ): Promise<TwoFactorChallenge> {
    const remaining = this.remainingCooldown(utilisateur.twoFactorLastSentAt);
    const hasValidCode =
      Boolean(utilisateur.twoFactorCodeHash) &&
      utilisateur.twoFactorExpiresAt instanceof Date &&
      utilisateur.twoFactorExpiresAt.getTime() > Date.now();
    const reuseExistingCode = remaining > 0 && hasValidCode;

    if (!reuseExistingCode) {
      await this.sendTwoFactorCode(utilisateur);
    }

    const expiresInSeconds = reuseExistingCode
      ? Math.max(
          1,
          Math.floor(
            (utilisateur.twoFactorExpiresAt.getTime() - Date.now()) / 1000,
          ),
        )
      : this.codeTtlMinutes * 60;

    const challengeTtlMinutes = Math.max(1, Math.ceil(expiresInSeconds / 60));
    const challengeToken = this.jwtService.sign(
      {
        sub: utilisateur.id,
        email: utilisateur.email,
        purpose: '2fa',
      } satisfies ChallengePayload,
      { expiresIn: `${challengeTtlMinutes}m` },
    );

    return {
      requiresTwoFactor: true,
      challengeToken,
      email: utilisateur.email,
      expiresInSeconds,
      resendAfterSeconds: reuseExistingCode ? remaining : this.resendSeconds,
      message: reuseExistingCode
        ? 'Un code de connexion est déjà actif. Utilisez le dernier code reçu.'
        : 'Un code de connexion à 6 chiffres vous a été envoyé par e-mail.',
    };
  }

  private async issueTokens(
    utilisateur: any,
    meta: RefreshMeta = {},
  ): Promise<AuthTokens> {
    const accessToken = this.signAccessToken(utilisateur);
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.parseDurationMs(this.refreshExpiresIn, 30 * 86400000),
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        utilisateurId: utilisateur.id,
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      expiresIn: Math.floor(
        this.parseDurationMs(this.accessExpiresIn, 15 * 60000) / 1000,
      ),
      user: this.toProfile(utilisateur),
    };
  }

  private signAccessToken(utilisateur: any): string {
    return this.jwtService.sign(
      {
        sub: utilisateur.id,
        email: utilisateur.email,
        role: utilisateur.role,
      },
      {
        expiresIn: Math.floor(
          this.parseDurationMs(this.accessExpiresIn, 15 * 60000) / 1000,
        ),
      },
    );
  }

  private async sendEmailVerificationCode(utilisateur: any): Promise<boolean> {
    const code = this.generateCode();
    const targetEmail = utilisateur.pendingEmail || utilisateur.email;

    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        emailVerificationCodeHash: this.hashCode(
          targetEmail,
          'email-verification',
          code,
        ),
        emailVerificationExpiresAt: this.codeExpiry(),
        emailVerificationAttempts: 0,
        emailVerificationLastSentAt: new Date(),
      },
    });

    const emailSent = await this.trySendEmail(() =>
      this.emailService.sendVerificationCode(
        targetEmail,
        code,
        this.codeTtlMinutes,
      ),
    );

    if (!emailSent) {
      await this.prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          emailVerificationCodeHash: null,
          emailVerificationExpiresAt: null,
          emailVerificationAttempts: 0,
          emailVerificationLastSentAt: null,
        },
      });
    }

    return emailSent;
  }

  private async sendTwoFactorCode(utilisateur: any): Promise<void> {
    const code = this.generateCode();

    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        twoFactorCodeHash: this.hashCode(utilisateur.email, 'two-factor', code),
        twoFactorExpiresAt: this.codeExpiry(),
        twoFactorAttempts: 0,
        twoFactorLastSentAt: new Date(),
      },
    });

    try {
      await this.emailService.sendTwoFactorCode(
        utilisateur.email,
        code,
        this.codeTtlMinutes,
      );
    } catch (error) {
      await this.prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          twoFactorCodeHash: null,
          twoFactorExpiresAt: null,
          twoFactorAttempts: 0,
          twoFactorLastSentAt: null,
        },
      });

      this.logger.error(
        `Impossible d'envoyer le code 2FA à ${utilisateur.email}: ${this.errorDetails(error)}`,
      );
      throw new ServiceUnavailableException({
        code: 'EMAIL_SEND_FAILED',
        message:
          'Impossible d’envoyer le code de connexion. Veuillez réessayer.',
      });
    }
  }

  private async assertAndConsumeCode(params: {
    storedHash: string | null;
    expiresAt: Date | null;
    attempts: number;
    email: string;
    purpose: string;
    code: string;
    onInvalidAttempt: (attempts: number) => Promise<void>;
    onLocked: () => Promise<void>;
  }): Promise<void> {
    const {
      storedHash,
      expiresAt,
      attempts,
      email,
      purpose,
      code,
      onInvalidAttempt,
      onLocked,
    } = params;

    if (!storedHash || !expiresAt) {
      throw new BadRequestException({
        code: 'INVALID_CODE',
        message: 'Code invalide ou expiré.',
      });
    }

    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'CODE_EXPIRED',
        message: 'Ce code a expiré. Demandez un nouveau code.',
      });
    }

    if (attempts >= this.maxCodeAttempts) {
      await onLocked();
      throw new HttpException(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Trop de tentatives. Demandez un nouveau code.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expected = this.hashCode(email, purpose, code);
    const provided = Buffer.from(storedHash, 'hex');
    const computed = Buffer.from(expected, 'hex');
    const matches =
      provided.length === computed.length &&
      timingSafeEqual(provided, computed);

    if (!matches) {
      const nextAttempts = attempts + 1;
      await onInvalidAttempt(nextAttempts);

      if (nextAttempts >= this.maxCodeAttempts) {
        await onLocked();
        throw new HttpException(
          {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Trop de tentatives. Demandez un nouveau code.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException({
        code: 'INVALID_CODE',
        message: 'Code invalide ou expiré.',
      });
    }
  }

  private verifyChallengeToken(token: string): ChallengePayload {
    try {
      const payload = this.jwtService.verify<ChallengePayload>(token);

      if (payload.purpose !== '2fa' || !payload.sub) {
        throw new Error('Invalid challenge');
      }

      return payload;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_CHALLENGE',
        message: 'Session de vérification expirée. Reconnectez-vous.',
      });
    }
  }

  private async revokeAllRefreshTokens(utilisateurId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { utilisateurId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toProfile(utilisateur: any): UserProfile {
    return {
      uid: utilisateur.id,
      email: utilisateur.email,
      pendingEmail: utilisateur.pendingEmail || undefined,
      nom: utilisateur.pseudo,
      prenom: utilisateur.prenom || '',
      telephone: utilisateur.telephone || undefined,
      photoUrl: utilisateur.photoUrl || undefined,
      role: utilisateur.role as UserRole,
      dateCreation: utilisateur.dateCreation.toISOString(),
      emailVerified: utilisateur.emailVerified !== false,
      twoFactorEnabled: utilisateur.twoFactorEnabled !== false,
      provider: utilisateur.googleId ? 'google' : 'local',
      hasPassword: Boolean(utilisateur.passwordHash),
    };
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashCode(email: string, purpose: string, code: string): string {
    return createHmac('sha256', this.otpPepper)
      .update(`${purpose}:${this.normalizeEmail(email)}:${code}`)
      .digest('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async compareDummyPassword(password: string): Promise<void> {
    try {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    } catch {
      return;
    }
  }

  private codeExpiry(): Date {
    return new Date(Date.now() + this.codeTtlMinutes * 60000);
  }

  private remainingCooldown(lastSentAt: Date | null): number {
    if (!lastSentAt) return 0;
    const elapsedSeconds = Math.floor(
      (Date.now() - lastSentAt.getTime()) / 1000,
    );
    return Math.max(0, this.resendSeconds - elapsedSeconds);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private parseDurationMs(value: string, fallbackMs: number): number {
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());

    if (!match) return fallbackMs;

    const amount = parseInt(match[1], 10);
    const unit = (match[2] || 's').toLowerCase();

    switch (unit) {
      case 'ms':
        return amount;
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60000;
      case 'h':
        return amount * 3600000;
      case 'd':
        return amount * 86400000;
      default:
        return fallbackMs;
    }
  }

  private readInt(name: string, fallback: number): number {
    const value = parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private async trySendEmail(send: () => Promise<void>): Promise<boolean> {
    try {
      await send();
      return true;
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi de l'e-mail: ${this.errorDetails(error)}`,
      );
      return false;
    }
  }

  private errorDetails(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Erreur inconnue';
  }
}
