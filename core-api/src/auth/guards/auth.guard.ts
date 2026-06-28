import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

// ---------------------------------------------------------------------------
// AuthGuard : équivalent du middleware requireAuth de l'ancienne version.
// Se place sur un controller ou une route avec @UseGuards(AuthGuard).
// Le token décodé est attaché à request.user, récupérable ensuite via le
// décorateur @CurrentUser() (voir decorators/current-user.decorator.ts).
// ---------------------------------------------------------------------------

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Token manquant. Utilisez le header Authorization: Bearer <token>',
      );
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decoded = await this.authService.verifyToken(token);
      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
