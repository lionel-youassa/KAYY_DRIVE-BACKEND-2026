import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

// ---------------------------------------------------------------------------
// AdminGuard : équivalent du middleware requireAdmin.
// S'utilise TOUJOURS après AuthGuard (qui remplit request.user) :
// @UseGuards(AuthGuard, AdminGuard)
// ---------------------------------------------------------------------------

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    return true;
  }
}
