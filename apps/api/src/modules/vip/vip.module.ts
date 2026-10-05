import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { VipEnquiriesController } from './vip-enquiries.controller.js';
import { VipEnquiriesService } from './vip-enquiries.service.js';

@Module({
  imports: [AuthModule],
  controllers: [VipEnquiriesController],
  providers: [VipEnquiriesService],
  exports: [VipEnquiriesService],
})
export class VipModule {}
