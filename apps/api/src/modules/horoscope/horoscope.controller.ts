import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import {
  type ConfirmHoroscopeChartRequest,
  type HoroscopeChartUploadRequest,
  type MyHoroscopeResponse,
  type UpdateHoroscopeRequest,
  confirmHoroscopeChartSchema,
  horoscopeChartUploadRequestSchema,
  updateHoroscopeSchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { HoroscopeService } from './horoscope.service.js';

// The caller's own horoscope. Other members only ever see it through
// GET /profiles/:id, filtered by the owner's visibility setting.
@Controller('me/horoscope')
@UseGuards(JwtAuthGuard)
export class HoroscopeController {
  constructor(private readonly horoscope: HoroscopeService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MyHoroscopeResponse> {
    return this.horoscope.getMine(user.userId);
  }

  @Put()
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateHoroscopeSchema))
    body: UpdateHoroscopeRequest,
  ): Promise<MyHoroscopeResponse> {
    return this.horoscope.save(user.userId, body);
  }

  @Post('chart/upload-url')
  chartUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(horoscopeChartUploadRequestSchema))
    body: HoroscopeChartUploadRequest,
  ) {
    return this.horoscope.createChartUploadUrl(user.userId, body.contentType);
  }

  @Post('chart/confirm')
  confirmChart(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(confirmHoroscopeChartSchema))
    body: ConfirmHoroscopeChartRequest,
  ): Promise<MyHoroscopeResponse> {
    return this.horoscope.confirmChart(user.userId, body.objectKey);
  }

  @Delete('chart')
  deleteChart(@CurrentUser() user: AuthenticatedUser): Promise<MyHoroscopeResponse> {
    return this.horoscope.deleteChart(user.userId);
  }
}
