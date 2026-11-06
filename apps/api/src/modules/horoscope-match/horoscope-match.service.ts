import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type HoroscopeMatchResponse, type OrderResponse, computePorutham, poruthamVerdict } from '@nadar-kalyanam/schemas';
import type { Env } from '../config/env.schema.js';
import { canViewHoroscope, effectiveStars } from '../horoscope/horoscope.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';

type Side = Extract<HoroscopeMatchResponse, { status: 'READY' }>['bride'];
type Unavailable = Extract<HoroscopeMatchResponse, { status: 'UNAVAILABLE' }>;

// The ₹99 horoscope match: the ten poruthams between the caller and one
// other member, bought once per pair by anyone (plan or not). It needs both
// stars and rasis (entered, or worked out from birth details), and the other
// member must share their horoscope with the caller (the same rule as their
// profile page). The report is worked out fresh each time it's opened.
@Injectable()
export class HoroscopeMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Both sides, or why they can't be matched. getOtherProfile 404s hidden,
  // blocked and unknown profiles, and the caller's own.
  private async sides(userId: string, profileId: string) {
    const them = await this.profiles.getOtherProfile(userId, profileId);
    const me = await this.prisma.profile.findUnique({ where: { userId }, include: { horoscope: true } });
    const theirs = await this.prisma.profileHoroscope.findUnique({ where: { profileId: them.id } });
    const unavailable = (reason: Unavailable['reason'], message: string) => ({ ok: false as const, unavailable: { status: 'UNAVAILABLE' as const, reason, message } });

    if (!me || me.gender === them.gender || me.gender === 'OTHER' || them.gender === 'OTHER') {
      return unavailable('SAME_GENDER', 'Horoscope matching is between a bride and a groom.');
    }
    const mine = me.horoscope ? effectiveStars(me.horoscope, me.dateOfBirth) : null;
    if (!mine?.rasi || !mine.nakshatra) {
      return unavailable('ADD_YOUR_HOROSCOPE', 'Add your rasi and star, or your birth time and place, in My Horoscope to check the match.');
    }
    const relationship = (await this.profiles.getRelationshipStates(userId, [them.userId])).get(them.userId);
    const shared = theirs && canViewHoroscope(theirs.visibility, relationship?.status);
    const their = shared ? effectiveStars(theirs, them.dateOfBirth) : null;
    if (!their?.rasi || !their.nakshatra) {
      return unavailable('THEIR_HOROSCOPE_NOT_SHARED', `${them.fullName} hasn't shared a horoscope with you yet.`);
    }
    const side = (name: string, stars: { rasi: Side['rasi']; nakshatra: Side['nakshatra'] }, row: typeof theirs): Side => ({
      name,
      rasi: stars.rasi,
      nakshatra: stars.nakshatra,
      sevvaiDosham: (row?.sevvaiDosham ?? null) as Side['sevvaiDosham'],
      raguKethuDosham: (row?.raguKethuDosham ?? null) as Side['raguKethuDosham'],
    });
    const mySide = side(me.fullName, { rasi: mine.rasi, nakshatra: mine.nakshatra }, me.horoscope);
    const theirSide = side(them.fullName, { rasi: their.rasi, nakshatra: their.nakshatra }, theirs);
    return me.gender === 'FEMALE'
      ? { ok: true as const, bride: mySide, groom: theirSide, them }
      : { ok: true as const, bride: theirSide, groom: mySide, them };
  }

  async get(userId: string, profileId: string): Promise<HoroscopeMatchResponse> {
    const sides = await this.sides(userId, profileId);
    if (!sides.ok) return sides.unavailable;
    const bought = await this.prisma.horoscopeMatch.findUnique({ where: { userId_profileId: { userId, profileId: sides.them.id } } });
    if (!bought) return { status: 'LOCKED', priceInPaise: this.config.get('HOROSCOPE_MATCH_PRICE_IN_PAISE', { infer: true }) };
    const results = computePorutham(sides.bride, sides.groom);
    return {
      status: 'READY',
      bride: sides.bride,
      groom: sides.groom,
      results,
      score: results.filter((r) => r.matched).length,
      verdict: poruthamVerdict(results),
    };
  }

  async createOrder(userId: string, profileId: string): Promise<OrderResponse> {
    const state = await this.get(userId, profileId);
    if (state.status === 'UNAVAILABLE') throw new ConflictException(state.message);
    if (state.status === 'READY') throw new ConflictException('You already have this horoscope match');
    return this.payments.createHoroscopeMatchOrder(userId, profileId);
  }
}
