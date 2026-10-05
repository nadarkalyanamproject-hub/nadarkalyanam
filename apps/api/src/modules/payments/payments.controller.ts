import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  type CreateOrderRequest,
  createOrderRequestSchema,
  type PaymentWebhookEventInput,
  paymentWebhookEventSchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { PaymentsService } from './payments.service.js';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('membership-plans')
  listPlans() {
    return this.paymentsService.listPlans();
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrderRequestSchema)) body: CreateOrderRequest,
  ) {
    return this.paymentsService.createOrder(user.userId, body.planId);
  }

  @Get('payments/history')
  @UseGuards(JwtAuthGuard)
  listHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.listHistory(user.userId);
  }

  // No JwtAuthGuard: the caller is the payment provider, authenticated by
  // the HMAC signature (FR-7.3), not a member bearer token. The signature
  // is checked over the exact request bytes (`rawBody`, kept for this route
  // only — see main.ts). 200 for processed, duplicate and ignored events,
  // so the provider stops retrying; 400 for a bad signature, an unknown
  // order or a mismatched amount.
  @Post('payments/webhook')
  @HttpCode(200)
  handleWebhook(
    @Headers('x-webhook-signature') signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
    @Body(new ZodValidationPipe(paymentWebhookEventSchema)) body: PaymentWebhookEventInput,
  ) {
    if (!request.rawBody) throw new BadRequestException('Missing request body');
    return this.paymentsService.handleWebhook(request.rawBody, signature, body);
  }
}
