import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { type ShortlistRequest, shortlistRequestSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { ShortlistsService } from './shortlists.service.js';
import { PlanRequiredGuard } from '../../common/plan-required.guard.js';

@Controller('shortlists')
@UseGuards(JwtAuthGuard, PlanRequiredGuard)
export class ShortlistsController {
  constructor(private readonly shortlistsService: ShortlistsService) {}

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(shortlistRequestSchema)) body: ShortlistRequest,
  ) {
    return this.shortlistsService.add(user.userId, body.profileId);
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.shortlistsService.listMine(user.userId);
  }

  @Get('shortlisted-me')
  listShortlistedMe(@CurrentUser() user: AuthenticatedUser) {
    return this.shortlistsService.listShortlistedMe(user.userId);
  }

  // Whether the caller has shortlisted this profile (drives the toggle).
  @Get('by-profile/:profileId')
  status(@CurrentUser() user: AuthenticatedUser, @Param('profileId') profileId: string) {
    return this.shortlistsService.status(user.userId, profileId);
  }

  @Delete('by-profile/:profileId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('profileId') profileId: string) {
    return this.shortlistsService.remove(user.userId, profileId);
  }
}
