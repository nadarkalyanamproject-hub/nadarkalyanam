import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { type PartnerPreferences, type PartnerPreferencesResponse, partnerPreferencesSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { PartnerPreferencesService } from './partner-preferences.service.js';

// The caller's own partner preferences — no route takes another member's id.
@Controller('me/partner-preferences')
@UseGuards(JwtAuthGuard)
export class PartnerPreferencesController {
  constructor(private readonly preferences: PartnerPreferencesService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<PartnerPreferencesResponse> {
    return this.preferences.getMine(user.userId);
  }

  @Put()
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(partnerPreferencesSchema))
    body: PartnerPreferences,
  ): Promise<PartnerPreferencesResponse> {
    return this.preferences.save(user.userId, body);
  }

  @Delete()
  reset(@CurrentUser() user: AuthenticatedUser): Promise<PartnerPreferencesResponse> {
    return this.preferences.reset(user.userId);
  }
}
