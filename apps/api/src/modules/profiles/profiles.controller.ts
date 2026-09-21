import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { type CreateProfileRequest, createProfileSchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { ProfilesService } from './profiles.service.js';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProfileSchema)) body: CreateProfileRequest,
  ) {
    const profile = await this.profilesService.createProfile(user.userId, body);
    return { id: profile.id, completionScore: profile.completionScore };
  }
}
