import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  type CreateProfileRequest,
  type PhotoResponse,
  type ProfileListResponse,
  type ProfileResponse,
  type PublicProfileDetail,
  createProfileSchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import type { Profile } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { ProfilesService } from './profiles.service.js';
import { toPublicProfileDetail, toPublicProfileSummary } from './public-profile.mapper.js';

// Re-exported so existing imports of the public mappers keep working.
export { toPublicProfileDetail, toPublicProfileSummary };

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

  // "Browse Profiles". Simple offset pagination — ?offset=0&limit=20 by
  // default, capped at 50 per page since nothing here needs to be fancy yet.
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('offset') offsetParam?: string,
    @Query('limit') limitParam?: string,
  ): Promise<ProfileListResponse> {
    const offset = Math.max(0, Number.parseInt(offsetParam ?? '0', 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(limitParam ?? '20', 10) || 20));

    const { profiles, total } = await this.profilesService.listOtherProfiles(user.userId, offset, limit);
    // One batched query for the whole page, not one per profile.
    const relationships = await this.profilesService.getRelationshipStates(
      user.userId,
      profiles.map((profile) => profile.userId),
    );
    const items = await Promise.all(
      profiles.map(async (profile) => {
        const photos = await this.photosService.getPhotosForProfile(profile.id);
        const primaryPhotoUrl = photos.find((photo) => photo.isPrimary)?.url ?? photos[0]?.url ?? null;
        return toPublicProfileSummary(profile, primaryPhotoUrl, relationships.get(profile.userId));
      }),
    );

    const nextOffset = offset + items.length < total ? offset + items.length : null;
    return { items, nextOffset };
  }

  // NOTE: must stay registered after the `me` route above — Nest/Express
  // matches routes in declaration order, and this :id param would otherwise
  // swallow /profiles/me.
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PublicProfileDetail> {
    const profile = await this.profilesService.getOtherProfile(user.userId, id);
    const photos = await this.photosService.getPhotosForProfile(profile.id);
    const relationships = await this.profilesService.getRelationshipStates(user.userId, [profile.userId]);
    return toPublicProfileDetail(profile, photos, relationships.get(profile.userId));
  }
}
