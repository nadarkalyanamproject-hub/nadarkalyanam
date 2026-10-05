import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { type CreateVipEnquiryRequest, createVipEnquiryRequestSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { VipEnquiriesService } from './vip-enquiries.service.js';

// Members asking to be contacted about the VIP Assisted plan.
@Controller('vip-enquiries')
@UseGuards(JwtAuthGuard)
export class VipEnquiriesController {
  constructor(private readonly enquiries: VipEnquiriesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createVipEnquiryRequestSchema)) body: CreateVipEnquiryRequest,
  ) {
    return this.enquiries.create(user.userId, body.message);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.enquiries.mine(user.userId);
  }
}
