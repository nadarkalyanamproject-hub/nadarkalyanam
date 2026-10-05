import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PAYMENT_GATEWAY_ADAPTER } from './adapters/payment-gateway.adapter.js';
import { StubPaymentGatewayAdapter } from './adapters/stub-payment-gateway.adapter.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PAYMENT_GATEWAY_ADAPTER, useClass: StubPaymentGatewayAdapter }],
})
export class PaymentsModule {}
