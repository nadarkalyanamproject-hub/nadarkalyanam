import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { MatchingService } from './matching.service.js';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limitParam?: string) {
    const limit = Math.min(50, Math.max(1, Number.parseInt(limitParam ?? '20', 10) || 20));
    return this.matchingService.listMatches(user.userId, limit);
  }
}
