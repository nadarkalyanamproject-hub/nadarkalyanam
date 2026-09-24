import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { type SearchProfilesQuery, searchProfilesQuerySchema } from '@nadar-kalyanam/schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { DiscoveryService } from './discovery.service.js';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('profiles')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(searchProfilesQuerySchema)) query: SearchProfilesQuery,
  ) {
    return this.discoveryService.search(user.userId, query);
  }
}
