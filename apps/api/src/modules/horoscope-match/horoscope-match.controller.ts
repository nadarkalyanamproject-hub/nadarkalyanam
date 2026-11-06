import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { HoroscopeMatchResponse, OrderResponse } from '@nadar-kalyanam/schemas';
import { PlanRequiredGuard } from '../../common/plan-required.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { HoroscopeMatchService } from './horoscope-match.service.js';

// Paid per pair by everyone, so behind the same guard as viewing profiles
// (open to free members), not the members-only one.
@Controller('horoscope-match')
@UseGuards(JwtAuthGuard, PlanRequiredGuard)
export class HoroscopeMatchController {
  constructor(private readonly matches: HoroscopeMatchService) {}

  @Get(':profileId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('profileId') profileId: string): Promise<HoroscopeMatchResponse> {
    return this.matches.get(user.userId, profileId);
  }

  // Then pay it like a plan (Razorpay checkout, or the dev test payment).
  @Post(':profileId/order')
  createOrder(@CurrentUser() user: AuthenticatedUser, @Param('profileId') profileId: string): Promise<OrderResponse> {
    return this.matches.createOrder(user.userId, profileId);
  }
}
