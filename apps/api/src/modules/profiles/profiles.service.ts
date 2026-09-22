import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateProfileRequest } from '@nadar-kalyanam/schemas';
import { PrismaService } from '../prisma/prisma.service.js';

function buildProfileData(input: CreateProfileRequest) {
  const { fullName, gender, dateOfBirth, motherTongue, email, personal, location, additional } = input;
  const { height, physicalStatus, maritalStatus, religion, casteCommunity, dosham } = personal;
  const { city, state, country, educationLevel, educationDetail, profession, employedIn, annualIncomeRange, annualIncomeCurrency } =
    location;

  return {
    fullName,
    gender,
    dateOfBirth: new Date(dateOfBirth),
    details: {
      motherTongue,
      email,
      height,
      physicalStatus,
      maritalStatus,
      religion,
      casteCommunity,
      dosham,
      location: { city, state, country },
      education: { educationLevel, educationDetail, profession, employedIn, annualIncomeRange, annualIncomeCurrency },
      additional,
    },
  };
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found for this user');
    }
    return profile;
  }

  async createProfile(userId: string, input: CreateProfileRequest) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Profile already exists for this user');
    }

    return this.prisma.profile.create({
      data: { userId, ...buildProfileData(input) },
    });
  }

  async updateProfile(userId: string, input: CreateProfileRequest) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found for this user');
    }

    // completionScore is intentionally left untouched here — it is a
    // known pre-existing gap (hardcoded to 0 on creation, never actually
    // calculated) and out of scope for this edit endpoint.
    return this.prisma.profile.update({
      where: { userId },
      data: buildProfileData(input),
    });
  }
}
