import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Usage dans un controller :
//
// @Get('me')
// @UseGuards(AuthGuard)
// getMe(@CurrentUser() user: DecodedIdToken) {
//   return this.authService.getUserProfile(user.uid);
// }
// ---------------------------------------------------------------------------

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
