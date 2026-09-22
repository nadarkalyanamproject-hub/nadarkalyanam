import { Body, Controller, Delete, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  type ConfirmPhotoRequest,
  type PhotoResponse,
  type RequestUploadUrlRequest,
  confirmPhotoSchema,
  requestUploadUrlSchema,
} from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { PhotosService } from './photos.service.js';

@Controller('profiles/me/photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post('upload-url')
  async requestUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(requestUploadUrlSchema)) body: RequestUploadUrlRequest,
  ) {
    return this.photosService.createUploadUrl(user.userId, body.contentType);
  }

  @Post('confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(confirmPhotoSchema)) body: ConfirmPhotoRequest,
  ): Promise<PhotoResponse> {
    return this.photosService.confirmPhoto(user.userId, body.objectKey);
  }

  @Patch(':id/primary')
  async setPrimary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PhotoResponse> {
    return this.photosService.setPrimaryPhoto(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.photosService.deletePhoto(user.userId, id);
  }
}
