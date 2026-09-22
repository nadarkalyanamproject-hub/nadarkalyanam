import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  type CreateProfileRequest,
  type PhotoResponse,
  type ProfileResponse,
  createProfileSchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import type { Profile } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { ProfilesService } from './profiles.service.js';

function toProfileResponse(profile: Profile, photos: PhotoResponse[]): ProfileResponse {
  return {
    id: profile.id,
    fullName: profile.fullName,
    gender: profile.gender as ProfileResponse['gender'],
    dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
    completionScore: profile.completionScore,
    details: profile.details as unknown as ProfileResponse['details'],
    photos,
  };
}

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly photosService: PhotosService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProfileSchema)) body: CreateProfileRequest,
  ) {
    const profile = await this.profilesService.createProfile(user.userId, body);
    return { id: profile.id, completionScore: profile.completionScore };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    const profile = await this.profilesService.getMyProfile(user.userId);
    const photos = await this.photosService.getPhotosForProfile(profile.id);
    return toProfileResponse(profile, photos);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProfileSchema)) body: CreateProfileRequest,
  ): Promise<ProfileResponse> {
    const profile = await this.profilesService.updateProfile(user.userId, body);
    const photos = await this.photosService.getPhotosForProfile(profile.id);
    return toProfileResponse(profile, photos);
  }
}
