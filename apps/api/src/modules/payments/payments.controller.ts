import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
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
  // the HMAC signature (FR-7.3), not a member bearer token.
  //
  // NOTE: verifies the signature over JSON.stringify(body) — the
  // body-parser-decoded and re-serialized payload, not the exact bytes the
  // provider signed. This is a scaffolding simplification; the real
  // integration must capture the true raw request body (e.g. via a raw-body
  // middleware scoped to this route) before this can pass a live provider's
  // signature check.
  @Post('payments/webhook')
  handleWebhook(
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body(new ZodValidationPipe(paymentWebhookEventSchema)) body: PaymentWebhookEventInput,
  ) {
    return this.paymentsService.handleWebhook(JSON.stringify(body), signature, body);
  }
}
