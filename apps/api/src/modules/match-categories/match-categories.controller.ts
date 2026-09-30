import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { MatchCategoriesService } from './match-categories.service.js';

@Controller('match-categories')
@UseGuards(JwtAuthGuard)
export class MatchCategoriesController {
  constructor(private readonly service: MatchCategoriesService) {}

  @Get('newly-joined')
  newlyJoined(@CurrentUser() user: AuthenticatedUser) {
    return this.service.newlyJoined(user.userId);
  }

  @Get('nearby')
  nearby(@CurrentUser() user: AuthenticatedUser) {
    return this.service.nearby(user.userId);
  }

  @Get('with-photos')
  withPhotos(@CurrentUser() user: AuthenticatedUser) {
    return this.service.withPhotos(user.userId);
  }

  @Get('viewed-me')
  viewedMe(@CurrentUser() user: AuthenticatedUser) {
    return this.service.viewedMe(user.userId);
  }

  @Get('viewed-by-me')
  viewedByMe(@CurrentUser() user: AuthenticatedUser) {
    return this.service.viewedByMe(user.userId);
  }
}
