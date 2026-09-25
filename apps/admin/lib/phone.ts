const COUNTRY_CODE = '+91';

export function isValidLocalPhone(digits: string): boolean {
  return /^\d{10}$/.test(digits);
}

export function toE164(digits: string): string {
  return `${COUNTRY_CODE}${digits}`;
}
