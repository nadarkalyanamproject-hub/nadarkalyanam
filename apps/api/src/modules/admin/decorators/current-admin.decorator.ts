import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedAdmin } from '../guards/admin-auth.guard.js';

export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
  const request = ctx.switchToHttp().getRequest<{ adminUser: AuthenticatedAdmin }>();
  return request.adminUser;
});
