import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly client = new OAuth2Client();
  private readonly clientIds: string[];

  constructor(private readonly configService: ConfigService) {
    const configuredIds =
      this.configService.get<string>('GOOGLE_CLIENT_IDS') ||
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      '';

    this.clientIds = configuredIds
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  get configured(): boolean {
    return this.clientIds.length > 0;
  }

  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Google Sign-In n’est pas configuré sur le serveur.',
      );
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientIds,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Jeton Google invalide.');
      }

      if (!payload.email_verified) {
        throw new UnauthorizedException('Adresse e-mail Google non vérifiée.');
      }

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: true,
        name: payload.name,
        givenName: payload.given_name,
        familyName: payload.family_name,
        picture: payload.picture,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.warn(
        `Jeton Google rejeté: ${
          error instanceof Error ? error.message : 'erreur inconnue'
        }`,
      );
      throw new UnauthorizedException('Jeton Google invalide ou expiré.');
    }
  }
}
