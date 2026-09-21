import { ConflictException, Injectable } from '@nestjs/common';
import type { CreateProfileRequest } from '@nadar-kalyanam/schemas';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, input: CreateProfileRequest) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Profile already exists for this user');
    }

    const { fullName, gender, dateOfBirth, motherTongue, email, personal, location, additional } = input;
    const { height, physicalStatus, maritalStatus, religion, casteCommunity, dosham } = personal;
    const { city, state, country, educationLevel, educationDetail, profession, employedIn, annualIncomeRange, annualIncomeCurrency } =
      location;

    return this.prisma.profile.create({
      data: {
        userId,
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
      },
    });
  }
}
