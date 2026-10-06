import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { UnlockedContactsResponse } from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../common/pagination.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { UnlockedContactsService } from './unlocked-contacts.service.js';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UnlockedContactsController {
  constructor(private readonly contacts: UnlockedContactsService) {}

  // "My Unlocked Contacts" — never contains a phone number.
  @Get('phone-unlocks')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<UnlockedContactsResponse> {
    const page = parseOffsetLimit(offset, limit, 50);
    return this.contacts.listMine(user.userId, page.offset, page.limit);
  }
}
