import * as schemas from '@nadar-kalyanam/schemas';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Profile } from '../generated/prisma/client.js';
import { toPublicProfileDetail, toPublicProfileSummary } from '../modules/profiles/public-profile.mapper.js';

// A member's phone number may leave the API in exactly one response: POST
// /profiles/:id/phone-unlock. Every other member-facing response shape is
// checked here for any field that could carry one.
const PHONE_FIELD = /^(phone|phoneNumber|mobile|mobileNumber|contactNumber|whatsapp)$/i;

const MEMBER_RESPONSES: Record<string, z.ZodType> = {
  profileResponse: schemas.profileResponseSchema,
  publicProfileSummary: schemas.publicProfileSummarySchema,
  publicProfileDetail: schemas.publicProfileDetailSchema,
  profileList: schemas.profileListResponseSchema,
  profileCardList: schemas.profileCardListResponseSchema,
  searchProfiles: schemas.searchProfilesResponseSchema,
  listMatches: schemas.listMatchesResponseSchema,
  nearbyMatches: schemas.nearbyMatchesResponseSchema,
  listInterests: schemas.listInterestsResponseSchema,
  interest: schemas.interestResponseSchema,
  listConnections: schemas.listConnectionsResponseSchema,
  conversationList: schemas.conversationListResponseSchema,
  conversationDetail: schemas.conversationDetailSchema,
  messageList: schemas.messageListResponseSchema,
  notifications: schemas.listNotificationsResponseSchema,
  shortlist: schemas.shortlistResponseSchema,
  blockedMembers: schemas.blockedMembersResponseSchema,
  myMembership: schemas.myMembershipResponseSchema,
  membershipPlan: schemas.membershipPlanResponseSchema,
  phoneStatus: schemas.phoneStatusResponseSchema,
  unlockedContacts: schemas.unlockedContactsResponseSchema,
  vipEnquiryMine: schemas.myVipEnquiryResponseSchema,
};

// Every object key reachable in a schema (through arrays, optionals,
// nullables, records, unions and intersections).
function allKeys(schema: z.ZodType, seen = new Set<z.ZodType>()): string[] {
  if (seen.has(schema)) return [];
  seen.add(schema);
  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape as Record<string, z.ZodType>).flatMap(([key, value]) => [key, ...allKeys(value, seen)]);
  }
  if (schema instanceof z.ZodArray) return allKeys(schema.element as z.ZodType, seen);
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return allKeys(schema.unwrap() as z.ZodType, seen);
  if (schema instanceof z.ZodRecord) return allKeys(schema.valueType as z.ZodType, seen);
  if (schema instanceof z.ZodUnion) return (schema.options as z.ZodType[]).flatMap((option) => allKeys(option, seen));
  if (schema instanceof z.ZodIntersection) {
    const def = schema.def as unknown as { left: z.ZodType; right: z.ZodType };
    return [...allKeys(def.left, seen), ...allKeys(def.right, seen)];
  }
  return [];
}

describe('no phone number in any member-facing response', () => {
  it.each(Object.entries(MEMBER_RESPONSES))('%s has no phone field', (_name, schema) => {
    const keys = allKeys(schema);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => PHONE_FIELD.test(key))).toEqual([]);
  });

  it('the phone-unlock response is the one place a number appears', () => {
    expect(allKeys(schemas.phoneUnlockResponseSchema).filter((key) => PHONE_FIELD.test(key))).toEqual(['phoneNumber']);
  });

  it('the public profile mappers drop anything phone-like stored in the details blob', () => {
    const profile = {
      id: 'p1',
      userId: 'u1',
      fullName: 'Test Member',
      gender: 'FEMALE',
      dateOfBirth: new Date('1996-01-01'),
      visibility: 'MEMBERS_ONLY',
      phoneVisibility: 'CONNECTED',
      searchBoost: 0,
      isVerified: false,
      completionScore: 90,
      fieldVisibility: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      details: {
        phone: '+919812345678',
        phoneNumber: '+919812345678',
        mobile: '9812345678',
        location: { city: 'Chennai', state: 'Tamil Nadu' },
        education: { profession: 'Engineer' },
        religion: 'Hindu',
        maritalStatus: 'NEVER_MARRIED',
        additional: {},
      },
    } as unknown as Profile;

    const serialized = JSON.stringify([toPublicProfileSummary(profile, null, undefined), toPublicProfileDetail(profile, [], undefined)]);
    expect(serialized).not.toMatch(/9812345678/);
    expect(serialized).not.toMatch(/"phone/i);
  });

  it("no member-facing profile shape reveals another member's plan or listing tier", () => {
    const PLAN_FIELD = /^(plan|planCode|planName|searchBoost|searchTier|subscription|isPremium|premium|membership)$/i;
    for (const schema of [
      schemas.publicProfileSummarySchema,
      schemas.publicProfileDetailSchema,
      schemas.profileCardListResponseSchema,
      schemas.searchProfilesResponseSchema,
      schemas.listMatchesResponseSchema,
      schemas.listInterestsResponseSchema,
      schemas.conversationListResponseSchema,
      schemas.unlockedContactsResponseSchema,
    ]) {
      expect(allKeys(schema).filter((key) => PLAN_FIELD.test(key))).toEqual([]);
    }
  });
});
