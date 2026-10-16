import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { MembershipModule } from '../membership/membership.module.js';
import { PAYMENT_GATEWAY_ADAPTER } from './adapters/payment-gateway.adapter.js';
import { RazorpayPaymentGatewayAdapter } from './adapters/razorpay-payment-gateway.adapter.js';
import { StubPaymentGatewayAdapter } from './adapters/stub-payment-gateway.adapter.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [AuthModule, MembershipModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY_ADAPTER,
      useFactory: (configService: ConfigService<Env, true>) => {
        const provider = configService.get('PAYMENT_PROVIDER', { infer: true });
        if (provider === 'razorpay') {
          return new RazorpayPaymentGatewayAdapter(configService);
        }
        return new StubPaymentGatewayAdapter(configService);
      },
      inject: [ConfigService],
    },
  ],
})
export class PaymentsModule {}
