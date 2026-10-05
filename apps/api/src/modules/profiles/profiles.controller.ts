import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  type CreateProfileRequest,
  type PhotoResponse,
  type ProfileListResponse,
  type ProfileResponse,
  type PublicProfileDetail,
  type UpdateProfileVisibilityRequest,
  createProfileSchema,
  updateProfileVisibilitySchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { missingCompletionFields } from '../../common/profile-completion.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import type { Profile } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
    completionMissing: missingCompletionFields(profile, photos.length),
    visibility: profile.visibility,
    isVerified: profile.isVerified,
    details: profile.details as unknown as ProfileResponse['details'],
    photos,
  };
}

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly photosService: PhotosService,
    private readonly notifications: NotificationsService,
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
    // The owner sees all their photos, pending/rejected included.
    const photos = await this.photosService.getPhotosForProfile(profile.id, { includeUnapproved: true });
    return toProfileResponse(profile, photos);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProfileSchema)) body: CreateProfileRequest,
  ): Promise<ProfileResponse> {
    const profile = await this.profilesService.updateProfile(user.userId, body);
    // The owner sees all their photos, pending/rejected included.
    const photos = await this.photosService.getPhotosForProfile(profile.id, { includeUnapproved: true });
    return toProfileResponse(profile, photos);
  }

  // Privacy & Visibility: only the visibility field, so changing it never
  // resends (or risks overwriting) the rest of the profile.
  @Patch('me/visibility')
  @UseGuards(JwtAuthGuard)
  async updateMyVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileVisibilitySchema)) body: UpdateProfileVisibilityRequest,
  ): Promise<ProfileResponse> {
    const profile = await this.profilesService.updateVisibility(user.userId, body.visibility);
    // The owner sees all their photos, pending/rejected included.
    const photos = await this.photosService.getPhotosForProfile(profile.id, { includeUnapproved: true });
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
    // Only the detail view counts as a "view" (never list/search). By this
    // point getOtherProfile has already 404'd self-views, hidden profiles
    // and blocked pairs; JwtAuthGuard rejects admin tokens outright. The
    // 24h per-pair throttle is applied when the job is persisted.
    this.notifications.notify({
      recipientUserId: profile.userId,
      actorUserId: user.userId,
      type: 'PROFILE_VIEWED',
      targetType: 'Profile',
    });
    const photos = await this.photosService.getPhotosForProfile(profile.id);
    const relationships = await this.profilesService.getRelationshipStates(user.userId, [profile.userId]);
    return toPublicProfileDetail(profile, photos, relationships.get(profile.userId));
  }
}
