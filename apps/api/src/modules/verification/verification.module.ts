import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IDENTITY_PROVIDER_ADAPTER } from './adapters/identity-provider.adapter.js';
import { StubIdentityProviderAdapter } from './adapters/stub-identity-provider.adapter.js';
import { VerificationController } from './verification.controller.js';
import { VerificationService } from './verification.service.js';

@Module({
  imports: [AuthModule],
  controllers: [VerificationController],
  providers: [VerificationService, { provide: IDENTITY_PROVIDER_ADAPTER, useClass: StubIdentityProviderAdapter }],
})
export class VerificationModule {}
