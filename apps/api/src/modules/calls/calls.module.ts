import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RTC_PROVIDER_ADAPTER } from './adapters/rtc-provider.adapter.js';
import { StubRtcProviderAdapter } from './adapters/stub-rtc-provider.adapter.js';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CallsController],
  providers: [CallsService, { provide: RTC_PROVIDER_ADAPTER, useClass: StubRtcProviderAdapter }],
  exports: [CallsService],
})
export class CallsModule {}
