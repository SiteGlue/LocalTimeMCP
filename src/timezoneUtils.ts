import moment from 'moment-timezone';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { TimezoneMapping, ValidationError, TimezoneError } from './types.js';

// US ZIP code to timezone mapping based on first digit
const US_ZIP_TIMEZONE_MAP: Record<string, string> = {
  '0': 'America/New_York',    // Massachusetts, Rhode Island, New Hampshire, Maine, Vermont
  '1': 'America/New_York',    // Delaware, New York, Pennsylvania
  '2': 'America/New_York',    // District of Columbia, Maryland, North Carolina, South Carolina, Virginia, West Virginia
  '3': 'America/New_York',    // Alabama, Florida, Georgia, Mississippi, Tennessee, APO/FPO Americas
  '4': 'America/New_York',    // Indiana, Kentucky, Michigan, Ohio
  '5': 'America/Chicago',     // Iowa, Minnesota, Montana, North Dakota, South Dakota, Wisconsin
  '6': 'America/Chicago',     // Illinois, Kansas, Missouri, Nebraska
  '7': 'America/Chicago',     // Arkansas, Louisiana, Oklahoma, Texas
  '8': 'America/Denver',      // Arizona, Colorado, Idaho, New Mexico, Nevada, Utah, Wyoming
  '9': 'America/Los_Angeles'  // Alaska, American Samoa, California, Guam, Hawaii, Marshall Islands, Federated States of Micronesia, Northern Mariana Islands, Palau, Oregon, Washington, APO/FPO Pacific
};

// Canadian postal code to timezone mapping based on first letter
const CANADIAN_POSTAL_TIMEZONE_MAP: Record<string, string> = {
  'A': 'America/Halifax',     // Newfoundland and Labrador
  'B': 'America/Halifax',     // Nova Scotia, New Brunswick
  'C': 'America/Halifax',     // Prince Edward Island
  'E': 'America/Halifax',     // New Brunswick
  'G': 'America/Toronto',     // Quebec (Eastern part)
  'H': 'America/Toronto',     // Quebec (Montreal area)
  'J': 'America/Toronto',     // Quebec (Western part)
  'K': 'America/Toronto',     // Ontario (Eastern part)
  'L': 'America/Toronto',     // Ontario (Central part)
  'M': 'America/Toronto',     // Ontario (Toronto area)
  'N': 'America/Toronto',     // Ontario (Central part)
  'P': 'America/Toronto',     // Ontario (Northern part)
  'R': 'America/Winnipeg',    // Manitoba
  'S': 'America/Regina',      // Saskatchewan
  'T': 'America/Edmonton',    // Alberta
  'V': 'America/Vancouver',   // British Columbia
  'X': 'America/Edmonton',    // Northwest Territories, Nunavut (Central)
  'Y': 'America/Whitehorse'   // Yukon
};

/**
 * Validates if a string is a valid US ZIP code
 */
function isValidUSZip(zipCode: string): boolean {
  // US ZIP codes: 5 digits or 5+4 format (12345 or 12345-6789)
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
}

/**
 * Validates if a string is a valid Canadian postal code
 */
function isValidCanadianPostal(postalCode: string): boolean {
  // Canadian postal codes: A1A 1A1 or A1A1A1 format
  const postalRegex = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
  return postalRegex.test(postalCode);
}

/**
 * Determines if the input is a US ZIP code or Canadian postal code
 */
function getPostalCodeType(code: string): 'US' | 'CANADA' | 'INVALID' {
  const cleanCode = code.trim().toUpperCase();
  
  if (isValidUSZip(cleanCode)) {
    return 'US';
  }
  
  if (isValidCanadianPostal(cleanCode)) {
    return 'CANADA';
  }
  
  return 'INVALID';
}

/**
 * Maps a US ZIP code to its corresponding timezone
 */
function getUSTimezone(zipCode: string): string {
  const firstDigit = zipCode.charAt(0);
  const timezone = US_ZIP_TIMEZONE_MAP[firstDigit];
  
  if (!timezone) {
    throw new TimezoneError(`Unable to determine timezone for US ZIP code: ${zipCode}`);
  }
  
  return timezone;
}

/**
 * Maps a Canadian postal code to its corresponding timezone
 */
function getCanadianTimezone(postalCode: string): string {
  const firstLetter = postalCode.charAt(0).toUpperCase();
  const timezone = CANADIAN_POSTAL_TIMEZONE_MAP[firstLetter];
  
  if (!timezone) {
    throw new TimezoneError(`Unable to determine timezone for Canadian postal code: ${postalCode}`);
  }
  
  return timezone;
}

/**
 * Main function to get timezone from ZIP/postal code
 */
export function getTimezoneFromPostalCode(code: string): TimezoneMapping {
  if (!code || typeof code !== 'string') {
    throw new ValidationError('Postal code is required and must be a string');
  }
  
  const cleanCode = code.trim().toUpperCase();
  const codeType = getPostalCodeType(cleanCode);
  
  if (codeType === 'INVALID') {
    throw new ValidationError(`Invalid postal code format: ${code}. Must be a valid US ZIP code or Canadian postal code.`);
  }
  
  let timezone: string;
  
  try {
    if (codeType === 'US') {
      timezone = getUSTimezone(cleanCode);
    } else {
      timezone = getCanadianTimezone(cleanCode);
    }
    
    // Validate that the timezone exists in moment-timezone
    if (!moment.tz.zone(timezone)) {
      throw new TimezoneError(`Invalid timezone identifier: ${timezone}`);
    }
    
    return {
      timezone,
      name: moment.tz(timezone).format('z')
    };
    
  } catch (error) {
    if (error instanceof ValidationError || error instanceof TimezoneError) {
      throw error;
    }
    throw new TimezoneError(`Failed to determine timezone for postal code ${code}: ${error}`);
  }
}

/**
 * Gets current time in a specific timezone with comprehensive information
 */
export function getCurrentTimeInTimezone(timezone: string, format: '12' | '24' = '12'): {
  time: string;
  isDST: boolean;
  utcOffset: string;
  timezoneName: string;
} {
  try {
    const now = moment.tz(timezone);
    const isDST = now.isDST();
    const utcOffset = now.format('Z');
    const timezoneName = now.format('z');
    
    let timeFormat = format === '12' ? 'h:mm A z' : 'HH:mm z';
    const time = now.format(timeFormat);
    
    return {
      time,
      isDST,
      utcOffset,
      timezoneName
    };
  } catch (error) {
    throw new TimezoneError(`Failed to get current time for timezone ${timezone}: ${error}`);
  }
}

/**
 * Checks if a given timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    return moment.tz.zone(timezone) !== null;
  } catch {
    return false;
  }
}

/**
 * Gets all available timezones (useful for debugging)
 */
export function getAvailableTimezones(): string[] {
  return moment.tz.names();
}

/**
 * Format time for voice agent responses
 */
export function formatTimeForVoice(timezone: string, format: '12' | '24' = '12'): string {
  const timeInfo = getCurrentTimeInTimezone(timezone, format);
  return timeInfo.time;
}