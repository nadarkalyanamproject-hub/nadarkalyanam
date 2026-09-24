import { PrismaPg } from '@prisma/adapter-pg';
import { PERMISSIONS } from '../src/common/permissions.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  OPERATIONS_ADMIN: [PERMISSIONS.MEMBERS_SUSPEND, PERMISSIONS.MEMBERS_REINSTATE, PERMISSIONS.REPORTS_REVIEW],
  MODERATOR: [PERMISSIONS.MEMBERS_SUSPEND, PERMISSIONS.MEMBERS_REINSTATE, PERMISSIONS.REPORTS_REVIEW],
  VERIFICATION_AGENT: [PERMISSIONS.VERIFICATION_REVIEW],
  FINANCE_ADMIN: [PERMISSIONS.PAYMENTS_REFUND, PERMISSIONS.FINANCE_DASHBOARD_VIEW],
  CONTENT_ADMIN: [PERMISSIONS.CMS_MANAGE],
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DUMMY_SEED_PROFILES = [
  {
    phone: '+919876543201',
    fullName: 'Priya Soundararajan',
    gender: 'FEMALE',
    dateOfBirth: new Date('1998-05-14'),
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'priya.soundar@example.com',
      height: '5 ft 4 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Madurai', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'B.Tech',
        educationDetail: 'Computer Science & Engineering',
        profession: 'Software Architect',
        employedIn: 'Zoho Corporation',
        annualIncomeRange: '18 - 22 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Upper Middle Class',
        about: 'I am an ambitious, warm-hearted software professional from Madurai. I enjoy traditional family gatherings, reading, and exploring south Indian cuisine. Seeking a supportive life partner from our community.',
      },
    },
  },
  {
    phone: '+919876543202',
    fullName: 'Karthik Selvaraj',
    gender: 'MALE',
    dateOfBirth: new Date('1996-08-22'),
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'karthik.selvaraj@example.com',
      height: '5 ft 11 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'Postgraduate',
        educationDetail: 'MBA (IIM Kozhikode) & B.E. EEE',
        profession: 'Senior Product Manager',
        employedIn: 'Leading Fintech Enterprise',
        annualIncomeRange: '25 - 30 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Upper Middle Class',
        about: 'Born and raised in Chennai with native roots in Sivakasi. Balanced mindset with modern career aspirations and strong family morals. Looking for an educated, understanding bride.',
      },
    },
  },
  {
    phone: '+919876543203',
    fullName: 'Dr. Anitha Murugesan',
    gender: 'FEMALE',
    dateOfBirth: new Date('1997-11-03'),
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'anitha.murugesan@example.com',
      height: '5 ft 5 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Coimbatore', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'Doctorate',
        educationDetail: 'MBBS, MD (Pediatrics) - PSG IMS&R',
        profession: 'Pediatric Specialist',
        employedIn: 'Kovai Medical Center & Hospital',
        annualIncomeRange: '20 - 25 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Rich / Affluent (Elite)',
        about: 'Compassionate doctor practicing in Coimbatore. Passionate about children healthcare, classical music, and weekend badminton. Looking for a doctor or professional groom.',
      },
    },
  },
  {
    phone: '+919876543204',
    fullName: 'Er. Vignesh Pandian',
    gender: 'MALE',
    dateOfBirth: new Date('1995-03-18'),
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'vignesh.pandian@example.com',
      height: '5 ft 10 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'DONT_KNOW',
      location: { city: 'Tirunelveli', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'B.E.',
        educationDetail: 'Civil Engineering (TCE Madurai)',
        profession: 'Managing Partner',
        employedIn: 'Pandian Infra & Developers',
        annualIncomeRange: '30 - 40 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Upper Middle Class',
        about: 'Managing our family infrastructure business across South Tamil Nadu. Down to earth, energetic, and family-first. Looking for an affectionate partner with values.',
      },
    },
  },
  {
    phone: '+919876543205',
    fullName: 'Divya Ramachandran, CA',
    gender: 'FEMALE',
    dateOfBirth: new Date('1999-07-29'),
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'divya.ca@example.com',
      height: '5 ft 3 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Tuticorin', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'Chartered Accountant',
        educationDetail: 'CA (ICAI) & B.Com (Loyola)',
        profession: 'Senior Audit Associate',
        employedIn: 'Ernst & Young (EY)',
        annualIncomeRange: '14 - 18 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Middle Class',
        about: 'Simple, cheerful, and hardworking CA working with Big 4 consulting. Enjoy traditional art, cooking festive treats, and family outings. Seeking an honest and caring groom.',
      },
    },
  },
  {
    phone: '+919876543206',
    fullName: 'Saravanan Rajadurai',
    gender: 'MALE',
    dateOfBirth: new Date('1994-12-10'),
    photoUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'saravanan.rajadurai@example.com',
      height: '5 ft 9 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Virudhunagar', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'Postgraduate',
        educationDetail: 'MBA (International Business)',
        profession: 'Business Owner',
        employedIn: 'Rajadurai Spices & Oil Mills',
        annualIncomeRange: '40 - 50 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Rich / Affluent (Elite)',
        about: 'Established family trading & export enterprise in Virudhunagar. Respectful of traditions while having modern outlook on life and marriage. Looking for an understanding bride.',
      },
    },
  },
  {
    phone: '+919876543207',
    fullName: 'Meenakshi Sundaram',
    gender: 'FEMALE',
    dateOfBirth: new Date('2000-04-16'),
    photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'meenakshi.design@example.com',
      height: '5 ft 6 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Sivakasi', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'B.Des',
        educationDetail: 'Design & Visual Communication',
        profession: 'Product Designer',
        employedIn: 'Freshworks Inc.',
        annualIncomeRange: '16 - 20 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Upper Middle Class',
        about: 'Creative and outgoing designer living in Chennai with family in Sivakasi. Passionate about photography, heritage temples, and yoga. Seeking an open-minded companion.',
      },
    },
  },
  {
    phone: '+919876543208',
    fullName: 'Arun Kumar Nadar',
    gender: 'MALE',
    dateOfBirth: new Date('1993-09-05'),
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'arun.kumar.ai@example.com',
      height: '6 ft 0 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
      education: {
        educationLevel: 'Postgraduate',
        educationDetail: 'M.S. in Artificial Intelligence',
        profession: 'Senior AI Research Engineer',
        employedIn: 'Microsoft Research India',
        annualIncomeRange: '35 - 45 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Upper Middle Class',
        about: 'Tech enthusiast with a deep appreciation for classical Tamil traditions. Enjoy hiking, reading philosophy, and spending time with elders. Seeking a qualified and loving partner.',
      },
    },
  },
  {
    phone: '+919876543209',
    fullName: 'Kavitha Thangavel',
    gender: 'FEMALE',
    dateOfBirth: new Date('1996-01-21'),
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'kavitha.thangavel@example.com',
      height: '5 ft 4 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Christian',
      casteCommunity: 'Christian Nadar',
      dosham: 'NO',
      location: { city: 'Nagercoil', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'Postgraduate',
        educationDetail: 'M.Sc., M.Phil (Mathematics)',
        profession: 'Assistant Professor',
        employedIn: 'Autonomous Arts & Science College',
        annualIncomeRange: '10 - 12 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Middle Class',
        about: 'Dedicated academic professional with calm temperament and Christian family values. Enjoys gardening, choir music, and teaching. Seeking a God-fearing, educated Nadar groom.',
      },
    },
  },
  {
    phone: '+919876543210',
    fullName: 'Dinesh Raja',
    gender: 'MALE',
    dateOfBirth: new Date('1996-06-30'),
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
    details: {
      motherTongue: 'Tamil',
      email: 'dinesh.raja.sbi@example.com',
      height: '5 ft 10 in',
      physicalStatus: 'NORMAL',
      maritalStatus: 'NEVER_MARRIED',
      religion: 'Hindu',
      casteCommunity: 'Nadar',
      dosham: 'NO',
      location: { city: 'Tiruchirappalli', state: 'Tamil Nadu', country: 'India' },
      education: {
        educationLevel: 'B.Com',
        educationDetail: 'B.Com & CAIIB',
        profession: 'Branch Manager',
        employedIn: 'State Bank of India',
        annualIncomeRange: '14 - 18 Lakhs',
        annualIncomeCurrency: 'INR',
      },
      additional: {
        familyType: 'Middle Class',
        about: 'Banking officer with stable central government career. Sociable, respectful of family elders, and passionate about athletics and travel. Seeking a sweet-tempered companion.',
      },
    },
  },
];

async function main() {
  for (const code of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }

  for (const [roleName, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName } });
    for (const code of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const MEMBERSHIP_PLANS = [
    {
      id: 'plan-gold-3m',
      name: 'Gold - 3 months',
      priceInPaise: 149900,
      durationDays: 90,
      entitlements: {
        phoneNumbers: 50,
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
      },
    },
    {
      id: 'plan-gold-plus-3m',
      name: 'Gold + - 3 months',
      priceInPaise: 229900,
      durationDays: 90,
      entitlements: {
        phoneNumbers: 'Unlimited*',
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
        priorityListing: true,
      },
    },
    {
      id: 'plan-gold-premium-12m',
      name: 'Gold Premium - 12 months',
      priceInPaise: 599900,
      durationDays: 365,
      entitlements: {
        phoneNumbers: 'Unlimited*',
        unlimitedMessages: true,
        unlimitedHoroscopes: true,
        verifiedProfilesWithPhotos: true,
        dedicatedManager: true,
        prioritySpotlight: true,
      },
    },
  ];

  for (const plan of MEMBERSHIP_PLANS) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        priceInPaise: plan.priceInPaise,
        durationDays: plan.durationDays,
        entitlements: plan.entitlements,
        isActive: true,
      },
      create: {
        id: plan.id,
        name: plan.name,
        priceInPaise: plan.priceInPaise,
        durationDays: plan.durationDays,
        entitlements: plan.entitlements,
        isActive: true,
      },
    });
  }

  console.log('Seeded roles, permissions, and membership plans.');

  // Seed dummy test profiles
  for (const item of DUMMY_SEED_PROFILES) {
    const user = await prisma.user.upsert({
      where: { phoneNumber: item.phone },
      update: { status: 'ACTIVE' },
      create: {
        phoneNumber: item.phone,
        status: 'ACTIVE',
      },
    });

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        fullName: item.fullName,
        gender: item.gender,
        dateOfBirth: item.dateOfBirth,
        visibility: 'MEMBERS_ONLY',
        completionScore: 90,
        isVerified: true,
        details: item.details,
      },
      create: {
        userId: user.id,
        fullName: item.fullName,
        gender: item.gender,
        dateOfBirth: item.dateOfBirth,
        visibility: 'MEMBERS_ONLY',
        completionScore: 90,
        isVerified: true,
        details: item.details,
      },
    });

    // Seed primary photo
    const existingPhoto = await prisma.profilePhoto.findFirst({
      where: { profileId: profile.id },
    });

    if (!existingPhoto) {
      await prisma.profilePhoto.create({
        data: {
          profileId: profile.id,
          objectKey: item.photoUrl,
          isPrimary: true,
          sortOrder: 0,
          isModerated: true,
          isApproved: true,
        },
      });
    } else {
      await prisma.profilePhoto.update({
        where: { id: existingPhoto.id },
        data: {
          objectKey: item.photoUrl,
          isPrimary: true,
          isApproved: true,
          isModerated: true,
        },
      });
    }
  }

  console.log(`Seeded ${DUMMY_SEED_PROFILES.length} dummy test profiles successfully.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
