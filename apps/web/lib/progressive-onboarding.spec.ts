import { describe, expect, it } from 'vitest';
import {
  ANCESTRAL_ORIGINS,
  ANNUAL_INCOME_RANGES,
  DOSHAM_TYPES,
  EDUCATION_DETAILS,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  getCitiesForState,
  MOTHER_TONGUES,
  NADAR_SUBCATEGORIES,
  OCCUPATIONS,
  PRIOR_MARRIAGE_STATUSES,
  RELIGIONS,
} from '@nadar-kalyanam/schemas';

describe('Progressive Field Display Logic', () => {
  describe('Step 1 – Basic Details Progressive Visibility (Matching Reference Design)', () => {
    function getStep1Visibility(form: {
      fullName?: string;
      gender?: string;
      dateOfBirth?: string;
      religion?: string;
      email?: string;
      casteCommunity?: string;
    }) {
      const isFullNameComplete = Boolean(form.fullName && form.fullName.trim().length >= 2);
      const showGender = isFullNameComplete;

      const isGenderComplete = Boolean(form.gender && form.gender.trim() !== '');
      const showDob = showGender && isGenderComplete;

      const isDobComplete = Boolean(form.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth));
      const showReligionAndEmail = showDob && isDobComplete;

      const isReligionComplete = Boolean(form.religion && form.religion.trim() !== '');
      const isEmailValid = Boolean(form.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()));
      const showSubcategory = showReligionAndEmail && isReligionComplete && isEmailValid;

      const isCasteCommunityComplete = Boolean(form.casteCommunity && form.casteCommunity.trim() !== '');

      const isNextEnabled =
        isFullNameComplete &&
        isGenderComplete &&
        isDobComplete &&
        isReligionComplete &&
        isEmailValid &&
        isCasteCommunityComplete;

      return {
        showFullName: true,
        showGender,
        showDob,
        showReligionAndEmail,
        showSubcategory,
        isNextEnabled,
      };
    }

    it('initially displays ONLY Full Name when step is first opened', () => {
      const v = getStep1Visibility({ fullName: '' });
      expect(v.showFullName).toBe(true);
      expect(v.showGender).toBe(false);
      expect(v.showDob).toBe(false);
      expect(v.showReligionAndEmail).toBe(false);
      expect(v.showSubcategory).toBe(false);
      expect(v.isNextEnabled).toBe(false);
    });

    it('reveals Gender after Full Name is entered (>= 2 chars)', () => {
      let v = getStep1Visibility({ fullName: 'A' });
      expect(v.showGender).toBe(false);

      v = getStep1Visibility({ fullName: 'Arjun' });
      expect(v.showGender).toBe(true);
      expect(v.showDob).toBe(false);
    });

    it('reveals Date of Birth after Gender is selected', () => {
      const v = getStep1Visibility({
        fullName: 'Arjun',
        gender: 'MALE',
      });
      expect(v.showDob).toBe(true);
      expect(v.showReligionAndEmail).toBe(false);
    });

    it('reveals Religion and Email together after Date of Birth is completed', () => {
      const v = getStep1Visibility({
        fullName: 'Arjun',
        gender: 'MALE',
        dateOfBirth: '1998-05-20',
      });
      expect(v.showReligionAndEmail).toBe(true);
      expect(v.showSubcategory).toBe(false);
    });

    it('reveals Nadar Subcategory after Religion and Email are completed', () => {
      let v = getStep1Visibility({
        fullName: 'Arjun',
        gender: 'MALE',
        dateOfBirth: '1998-05-20',
        religion: 'Hindu',
        email: 'invalid-email',
      });
      expect(v.showSubcategory).toBe(false);

      v = getStep1Visibility({
        fullName: 'Arjun',
        gender: 'MALE',
        dateOfBirth: '1998-05-20',
        religion: 'Hindu',
        email: 'you@example.com',
      });
      expect(v.showSubcategory).toBe(true);
      expect(v.isNextEnabled).toBe(false);
    });

    it('enables Next button only when all required Step 1 fields are completed and valid', () => {
      const v = getStep1Visibility({
        fullName: 'Arjun',
        gender: 'MALE',
        dateOfBirth: '1998-05-20',
        religion: 'Hindu',
        email: 'you@example.com',
        casteCommunity: 'Karukkumattai',
      });
      expect(v.isNextEnabled).toBe(true);
    });
  });

  describe('Step 2 – Personal Details Progressive Visibility (Caste/Subcaste removed)', () => {
    function getStep2Visibility(form: {
      height: string;
      physicalStatus: string;
      maritalStatus: string;
      previousMarriageDetails?: string;
      complexion?: string;
      dosham?: string;
      doshamDetails?: string;
    }) {
      const isHeightComplete = Boolean(form.height && form.height.trim() !== '');
      const showPhysicalAndMarital = isHeightComplete;

      const isPhysicalAndMaritalComplete = Boolean(
        form.physicalStatus &&
        form.maritalStatus &&
        (!PRIOR_MARRIAGE_STATUSES.includes(form.maritalStatus) || (form.previousMarriageDetails?.trim() ?? '') !== '')
      );
      const showComplexionAndDosham = isHeightComplete && isPhysicalAndMaritalComplete;

      const isDoshamValid = form.dosham !== 'YES' || Boolean(form.doshamDetails?.trim());

      const isNextEnabled =
        isHeightComplete &&
        isPhysicalAndMaritalComplete &&
        isDoshamValid;

      return {
        showHeight: true,
        showPhysicalAndMarital,
        showComplexionAndDosham,
        showPreviousMarriageDetails: PRIOR_MARRIAGE_STATUSES.includes(form.maritalStatus),
        showDoshamDetails: form.dosham === 'YES',
        isNextEnabled,
      };
    }

    it('initially displays ONLY Height when step is first opened', () => {
      const v = getStep2Visibility({
        height: '',
        physicalStatus: '',
        maritalStatus: '',
      });
      expect(v.showHeight).toBe(true);
      expect(v.showPhysicalAndMarital).toBe(false);
      expect(v.showComplexionAndDosham).toBe(false);
      expect(v.isNextEnabled).toBe(false);
    });

    it('reveals Physical Status and Marital Status together after Height is completed', () => {
      const v = getStep2Visibility({
        height: `5'8" (173 cm)`,
        physicalStatus: '',
        maritalStatus: '',
      });
      expect(v.showPhysicalAndMarital).toBe(true);
      expect(v.showComplexionAndDosham).toBe(false);
    });

    it('reveals Previous Marriage Details only when Marital Status requires it', () => {
      let v = getStep2Visibility({
        height: `5'8" (173 cm)`,
        physicalStatus: 'NORMAL',
        maritalStatus: 'NEVER_MARRIED',
      });
      expect(v.showPreviousMarriageDetails).toBe(false);

      v = getStep2Visibility({
        height: `5'8" (173 cm)`,
        physicalStatus: 'NORMAL',
        maritalStatus: 'DIVORCED',
      });
      expect(v.showPreviousMarriageDetails).toBe(true);
    });

    it('reveals Complexion and Dosham (both optional) after completing Physical and Marital status', () => {
      const v = getStep2Visibility({
        height: `5'8" (173 cm)`,
        physicalStatus: 'NORMAL',
        maritalStatus: 'NEVER_MARRIED',
      });
      expect(v.showComplexionAndDosham).toBe(true);
      expect(v.isNextEnabled).toBe(true);
    });

    it('reveals attractive Dosham details dropdown when Dosham is YES, and keeps Dosh optional otherwise', () => {
      // Dosh is empty or NO -> still can proceed if required fields are filled
      let v = getStep2Visibility({
        height: `5'8" (173 cm)`,
        physicalStatus: 'NORMAL',
        maritalStatus: 'NEVER_MARRIED',
        dosham: 'NO',
      });
      expect(v.showDoshamDetails).toBe(false);
      expect(v.isNextEnabled).toBe(true);

      // Dosh = YES -> requires doshamDetails
      v = getStep2Visibility({
        height: `5'8" (173 cm)`,
        physicalStatus: 'NORMAL',
        maritalStatus: 'NEVER_MARRIED',
        dosham: 'YES',
        doshamDetails: '',
      });
      expect(v.showDoshamDetails).toBe(true);
      expect(v.isNextEnabled).toBe(false);

      // Dosh = YES and doshamDetails selected
      v = getStep2Visibility({
        height: `5'8" (173 cm)`,
        physicalStatus: 'NORMAL',
        maritalStatus: 'NEVER_MARRIED',
        dosham: 'YES',
        doshamDetails: 'Sevvai (Chevvai) Dosham',
      });
      expect(v.showDoshamDetails).toBe(true);
      expect(v.isNextEnabled).toBe(true);
    });
  });

  describe('Step 3 – Location & Professional Details Progressive Visibility', () => {
    function getStep3Visibility(form: {
      country: string;
      state: string;
      city: string;
      educationLevel: string;
      employedIn: string;
      profession: string;
      annualIncomeCurrency: string;
      annualIncomeRange: string;
    }) {
      const isCountryComplete = Boolean(form.country && form.country.trim() !== '');
      const showState = isCountryComplete;

      const isStateComplete = Boolean(form.state && form.state.trim() !== '');
      const showCity = showState && isStateComplete;

      const isCityComplete = Boolean(form.city && form.city.trim() !== '');
      const showProfessional = showCity && isCityComplete;

      const isProfessionalComplete = Boolean(
        form.educationLevel?.trim() && form.employedIn?.trim() && form.profession?.trim()
      );
      const showIncome = showProfessional && isProfessionalComplete;

      const isIncomeComplete = Boolean(form.annualIncomeCurrency && form.annualIncomeRange?.trim());

      const isNextEnabled =
        isCountryComplete &&
        isStateComplete &&
        isCityComplete &&
        isProfessionalComplete &&
        isIncomeComplete;

      return {
        showCountry: true,
        showState,
        showCity,
        showProfessional,
        showIncome,
        isNextEnabled,
      };
    }

    it('initially displays Country first, then State once Country is selected', () => {
      let v = getStep3Visibility({
        country: '',
        state: '',
        city: '',
        educationLevel: '',
        employedIn: '',
        profession: '',
        annualIncomeCurrency: 'INR',
        annualIncomeRange: '',
      });
      expect(v.showCountry).toBe(true);
      expect(v.showState).toBe(false);

      v = getStep3Visibility({
        country: 'India',
        state: '',
        city: '',
        educationLevel: '',
        employedIn: '',
        profession: '',
        annualIncomeCurrency: 'INR',
        annualIncomeRange: '',
      });
      expect(v.showState).toBe(true);
      expect(v.showCity).toBe(false);
    });

    it('displays City after State is selected', () => {
      const v = getStep3Visibility({
        country: 'India',
        state: 'Tamil Nadu',
        city: '',
        educationLevel: '',
        employedIn: '',
        profession: '',
        annualIncomeCurrency: 'INR',
        annualIncomeRange: '',
      });
      expect(v.showCity).toBe(true);
      expect(v.showProfessional).toBe(false);
    });

    it('displays Educational Details, Employment Type, and Occupation after City is selected', () => {
      const v = getStep3Visibility({
        country: 'India',
        state: 'Tamil Nadu',
        city: 'Chennai',
        educationLevel: '',
        employedIn: '',
        profession: '',
        annualIncomeCurrency: 'INR',
        annualIncomeRange: '',
      });
      expect(v.showProfessional).toBe(true);
      expect(v.showIncome).toBe(false);
    });

    it('displays Annual Income Currency and Annual Income after professional details are completed', () => {
      const v = getStep3Visibility({
        country: 'India',
        state: 'Tamil Nadu',
        city: 'Chennai',
        educationLevel: 'B.Tech',
        employedIn: 'Private',
        profession: 'Software Engineer',
        annualIncomeCurrency: 'INR',
        annualIncomeRange: '',
      });
      expect(v.showIncome).toBe(true);
      expect(v.isNextEnabled).toBe(false);
    });

    it('enables Next button when all location and professional details are complete', () => {
      const v = getStep3Visibility({
        country: 'India',
        state: 'Tamil Nadu',
        city: 'Chennai',
        educationLevel: 'B.Tech',
        employedIn: 'Private',
        profession: 'Software Engineer',
        annualIncomeCurrency: 'INR',
        annualIncomeRange: '12-15 LPA',
      });
      expect(v.isNextEnabled).toBe(true);
    });
  });

  describe('Step 4 – Additional Details Progressive Visibility', () => {
    function getStep4Visibility(form: {
      familyType: string;
      netWorth?: string;
      ancestralOrigin: string;
      ancestralOriginOther?: string;
      about: string;
    }) {
      const isFamilyTypeComplete = Boolean(form.familyType && form.familyType.trim() !== '');
      const showAncestralOrigin = isFamilyTypeComplete;

      const isAncestralOriginComplete = Boolean(form.ancestralOrigin && form.ancestralOrigin.trim() !== '');
      const showAncestralOriginOther = form.ancestralOrigin === 'Others';

      const showAbout = showAncestralOrigin && isAncestralOriginComplete;
      const isAboutComplete = Boolean(form.about && form.about.trim().length >= 50);

      const isSubmitEnabled = isFamilyTypeComplete && isAncestralOriginComplete && isAboutComplete;

      return {
        showFamilyStatus: true,
        showNetWorth: form.familyType === 'Rich / Affluent (Elite)',
        showAncestralOrigin,
        showAncestralOriginOther,
        showAbout,
        isSubmitEnabled,
      };
    }

    it('initially displays Family Status first', () => {
      const v = getStep4Visibility({
        familyType: '',
        ancestralOrigin: '',
        about: '',
      });
      expect(v.showFamilyStatus).toBe(true);
      expect(v.showAncestralOrigin).toBe(false);
      expect(v.showAbout).toBe(false);
      expect(v.isSubmitEnabled).toBe(false);
    });

    it('displays Ancestral Origin after Family Status is selected', () => {
      const v = getStep4Visibility({
        familyType: 'Middle Class',
        ancestralOrigin: '',
        about: '',
      });
      expect(v.showAncestralOrigin).toBe(true);
      expect(v.showAncestralOriginOther).toBe(false);
      expect(v.showAbout).toBe(false);
    });

    it('displays Enter ancestral origin (Optional) only when Others is selected', () => {
      let v = getStep4Visibility({
        familyType: 'Middle Class',
        ancestralOrigin: 'Tirunelveli',
        about: '',
      });
      expect(v.showAncestralOriginOther).toBe(false);
      expect(v.showAbout).toBe(true);

      v = getStep4Visibility({
        familyType: 'Middle Class',
        ancestralOrigin: 'Others',
        about: '',
      });
      expect(v.showAncestralOriginOther).toBe(true);
      expect(v.showAbout).toBe(true);
    });

    it('enables Submit button only when About is at least 50 characters', () => {
      let v = getStep4Visibility({
        familyType: 'Middle Class',
        ancestralOrigin: 'Madurai',
        about: 'Short about text',
      });
      expect(v.isSubmitEnabled).toBe(false);

      v = getStep4Visibility({
        familyType: 'Middle Class',
        ancestralOrigin: 'Madurai',
        about: 'I am a software professional looking for a kind, family-oriented partner with shared cultural values and goals in life.',
      });
      expect(v.isSubmitEnabled).toBe(true);
    });
  });

  describe('Reference Data Constants', () => {
    it('provides valid ancestral origin options including Others', () => {
      expect(ANCESTRAL_ORIGINS).toContain('Tirunelveli');
      expect(ANCESTRAL_ORIGINS).toContain('Thoothukudi (Tuticorin)');
      expect(ANCESTRAL_ORIGINS).toContain('Virudhunagar');
      expect(ANCESTRAL_ORIGINS).toContain('Others');
    });

    it('provides mother tongues and Nadar subcategories', () => {
      expect(MOTHER_TONGUES).toContain('Tamil');
      expect(NADAR_SUBCATEGORIES.length).toBeGreaterThan(0);
      expect(RELIGIONS).toContain('Hindu');
      expect(RELIGIONS).toContain('Christian');
    });

    it('provides dosham types for attractive dropdown', () => {
      expect(DOSHAM_TYPES).toContain('Sevvai (Chevvai) Dosham');
      expect(DOSHAM_TYPES).toContain('Rahu-Ketu Dosham');
      expect(DOSHAM_TYPES).toContain('Naga Dosham');
      expect(DOSHAM_TYPES).toContain('Other');
    });

    it('provides dropdown options for Step 3 location & professional details', () => {
      // City by state (including Nellore in AP from user image)
      const apCities = getCitiesForState('Andhra Pradesh');
      expect(apCities).toContain('Nellore');
      expect(apCities).toContain('Visakhapatnam');

      const tnCities = getCitiesForState('Tamil Nadu');
      expect(tnCities).toContain('Chennai');
      expect(tnCities).toContain('Madurai');
      expect(tnCities).toContain('Tirunelveli');
      expect(tnCities).toContain('Others');

      // Education levels dropdown
      expect(EDUCATION_LEVELS).toContain('Bachelors');
      expect(EDUCATION_LEVELS).toContain('Masters');
      expect(EDUCATION_LEVELS).toContain('B.E. / B.Tech');
      expect(EDUCATION_LEVELS).toContain('Doctorate');
      expect(EDUCATION_LEVELS).toContain('Other');

      // Education details dropdown
      expect(EDUCATION_DETAILS).toContain('Computer Science & Engineering');
      expect(EDUCATION_DETAILS).toContain('Mechanical Engineering');
      expect(EDUCATION_DETAILS).toContain('Other');

      // Employment types dropdown
      expect(EMPLOYMENT_TYPES).toContain('Private Sector');
      expect(EMPLOYMENT_TYPES).toContain('Government / Public Sector');
      expect(EMPLOYMENT_TYPES).toContain('Business / Self-Employed');
      expect(EMPLOYMENT_TYPES).toContain('Other');

      // Occupations dropdown
      expect(OCCUPATIONS).toContain('Software Engineer / Developer');
      expect(OCCUPATIONS).toContain('Doctor / Surgeon / Medical Specialist');
      expect(OCCUPATIONS).toContain('Chartered Accountant (CA) / Auditor');
      expect(OCCUPATIONS).toContain('Business Owner / Entrepreneur');
      expect(OCCUPATIONS).toContain('Other');

      // Annual income ranges dropdown
      expect(ANNUAL_INCOME_RANGES).toContain('₹10 - ₹15 Lakhs (10 - 15 LPA)');
      expect(ANNUAL_INCOME_RANGES).toContain('Less than ₹3 Lakhs');
      expect(ANNUAL_INCOME_RANGES).toContain('Above ₹1 Crore (1 Cr+)');
      expect(ANNUAL_INCOME_RANGES).toContain('Other');
    });
  });
});
