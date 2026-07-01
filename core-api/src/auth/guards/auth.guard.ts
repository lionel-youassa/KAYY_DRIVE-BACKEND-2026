import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

// ---------------------------------------------------------------------------
// AuthGuard : équivalent du middleware requireAuth de l'ancienne version.
// Se place sur un controller ou une route avec @UseGuards(AuthGuard).
// Le token décodé est attaché à request.user, récupérable ensuite via le
// décorateur @CurrentUser() (voir decorators/current-user.decorator.ts).
// ---------------------------------------------------------------------------

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token invalide ou expiré');
    }
    return user;
  }
}
