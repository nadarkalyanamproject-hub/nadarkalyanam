import { Body, Controller, Post } from '@nestjs/common';
import {
  type SendOtpRequest,
  type VerifyOtpRequest,
  sendOtpRequestSchema,
  verifyOtpRequestSchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body(new ZodValidationPipe(sendOtpRequestSchema)) body: SendOtpRequest) {
    return this.authService.requestOtp(body.phoneNumber);
  }

  @Post('otp/verify')
  verifyOtp(@Body(new ZodValidationPipe(verifyOtpRequestSchema)) body: VerifyOtpRequest) {
    return this.authService.verifyOtp(body.phoneNumber, body.otp, body.intent ?? 'register');
  }
}
