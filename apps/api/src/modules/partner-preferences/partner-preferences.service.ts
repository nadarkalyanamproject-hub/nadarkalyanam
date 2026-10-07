import { Injectable, NotFoundException } from '@nestjs/common';
import type { PartnerPreferences, PartnerPreferencesResponse, PreferenceFit, SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { preferenceFit, toSavedPreferences } from '../../common/preference-fit.js';
import type { Profile } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// A member's own partner preferences. Every method is keyed by the caller's
// own userId: there is no way to read another member's preferences.
@Injectable()
export class PartnerPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Create your profile first');
    return profile.id;
  }

  async getMine(userId: string): Promise<PartnerPreferencesResponse> {
    return { preferences: await this.findForUser(userId) };
  }

  // null when the member hasn't set any (or has no profile).
  async findForUser(userId: string): Promise<SavedPartnerPreferences | null> {
    const row = await this.prisma.partnerPreference.findFirst({
      where: { profile: { userId } },
    });
    return row ? toSavedPreferences(row) : null;
  }

  async save(userId: string, input: PartnerPreferences): Promise<PartnerPreferencesResponse> {
    const profileId = await this.ownProfileId(userId);
    const row = await this.prisma.partnerPreference.upsert({
      where: { profileId },
      create: { profileId, ...input },
      update: input,
    });
    return { preferences: toSavedPreferences(row) };
  }

  // "Reset": back to no preferences at all.
  async reset(userId: string): Promise<PartnerPreferencesResponse> {
    const profileId = await this.ownProfileId(userId);
    await this.prisma.partnerPreference.deleteMany({ where: { profileId } });
    return { preferences: null };
  }

  // "N of M of your preferences match" for the viewing member only. Null if
  // the viewer has no preferences set.
  async fitForViewer(viewerUserId: string, profile: Pick<Profile, 'dateOfBirth' | 'details'>): Promise<PreferenceFit | null> {
    const prefs = await this.findForUser(viewerUserId);
    if (!prefs) return null;
    const fit = preferenceFit(prefs, profile);
    return fit.total > 0 ? fit : null;
  }
}
