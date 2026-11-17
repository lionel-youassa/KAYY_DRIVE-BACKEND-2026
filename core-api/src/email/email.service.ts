import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

interface EmailPayload {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  code: string;
  expiresInMinutes: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.BREVO_API_KEY?.trim();
  private readonly senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  private readonly senderName =
    process.env.BREVO_SENDER_NAME?.trim() || 'KAYY Drive';

  readonly enabled = Boolean(this.apiKey && this.senderEmail);

  constructor(private readonly http: HttpService) {}

  async sendVerificationCode(
    to: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Vérifiez votre adresse e-mail - KAYY Drive',
      heading: 'Confirmez votre adresse e-mail',
      intro:
        'Bienvenue sur KAYY Drive. Utilisez le code ci-dessous pour activer votre compte.',
      code,
      expiresInMinutes,
    });
  }

  async sendTwoFactorCode(
    to: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Votre code de connexion - KAYY Drive',
      heading: 'Votre code de connexion',
      intro:
        'Une connexion à votre compte KAYY Drive nécessite une vérification. Saisissez ce code pour continuer.',
      code,
      expiresInMinutes,
    });
  }

  async sendPasswordResetCode(
    to: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Réinitialisation de votre mot de passe - KAYY Drive',
      heading: 'Réinitialisez votre mot de passe',
      intro:
        'Vous avez demandé la réinitialisation de votre mot de passe KAYY Drive. Saisissez ce code dans l’application.',
      code,
      expiresInMinutes,
    });
  }

  private async send(payload: EmailPayload): Promise<void> {
    const { to, subject, heading, intro, code, expiresInMinutes } = payload;

    if (!this.enabled) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `[DEV] Brevo non configuré. Code ${code} pour ${to} (${subject}).`,
        );
        return;
      }

      throw new ServiceUnavailableException(
        "Le service d'envoi d'e-mails n'est pas configuré.",
      );
    }

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
        <h1 style="font-size:22px;color:#e53935;margin-bottom:16px">${heading}</h1>
        <p style="font-size:15px;line-height:1.6">${intro}</p>
        <p style="font-size:13px;color:#6b7280;margin-top:24px">Votre code :</p>
        <div style="font-size:34px;font-weight:bold;letter-spacing:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;text-align:center;color:#111827">
          ${code}
        </div>
        <p style="font-size:13px;color:#6b7280;margin-top:16px">
          Ce code expire dans ${expiresInMinutes} minutes et ne peut être utilisé qu'une seule fois.
        </p>
        <p style="font-size:13px;color:#6b7280">
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.
        </p>
      </div>
    `;

    const textContent = `${heading}\n\n${intro}\n\nCode : ${code}\n\nCe code expire dans ${expiresInMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`;

    try {
      await lastValueFrom(
        this.http.post(
          'https://api.brevo.com/v3/smtp/email',
          {
            sender: {
              name: this.senderName,
              email: this.senderEmail,
            },
            to: [{ email: to }],
            subject,
            htmlContent,
            textContent,
          },
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          },
        ),
      );

      this.logger.log(`E-mail "${subject}" envoyé à ${to}`);
    } catch (error) {
      const details = this.errorDetails(error);
      this.logger.error(`Échec de l'envoi Brevo à ${to}: ${details}`);
      throw new ServiceUnavailableException(
        "L'envoi de l'e-mail a échoué. Veuillez réessayer.",
      );
    }
  }

  private errorDetails(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const response = (
        error as { response?: { data?: unknown; status?: number } }
      ).response;
      if (response?.data) {
        return JSON.stringify(response.data);
      }
      if (response?.status) {
        return `HTTP ${response.status}`;
      }
      const message = (error as { message?: string }).message;
      if (message) return message;
    }

    return 'Erreur inconnue';
  }
}
