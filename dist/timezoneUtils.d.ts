import moment from 'moment-timezone';
import { TimezoneMapping } from './types.js';
/**
 * Main function to get timezone from ZIP/postal code
 */
export declare function getTimezoneFromPostalCode(code: string): TimezoneMapping;
/**
 * Gets current time in a specific timezone with comprehensive information
 */
export declare function getCurrentTimeInTimezone(timezone: string, format?: '12' | '24'): {
    time: string;
    isDST: boolean;
    utcOffset: string;
    timezoneName: string;
};
/**
 * Gets current date in a specific timezone with various format options
 */
export declare function getCurrentDateInTimezone(timezone: string, format?: 'short' | 'medium' | 'long' | 'full' | string): {
    date: string;
    dayOfWeek: string;
    month: string;
    dayOfMonth: number;
    year: number;
    quarter: number;
    weekOfYear: number;
    dayOfYear: number;
};
/**
 * Gets both current date and time from a postal code
 */
export declare function getDateTimeFromPostalCode(code: string, options?: {
    timeFormat?: '12' | '24';
    dateFormat?: 'short' | 'medium' | 'long' | 'full' | string;
}): {
    postalCode: string;
    timezone: string;
    timezoneName: string;
    time: string;
    date: string;
    dateTime: string;
    isDST: boolean;
    utcOffset: string;
    dayOfWeek: string;
    additionalInfo: {
        month: string;
        dayOfMonth: number;
        year: number;
        quarter: number;
        weekOfYear: number;
        dayOfYear: number;
    };
};
/**
 * Gets date for a specific date in a timezone (useful for date calculations)
 */
export declare function getDateInTimezone(timezone: string, date: string | Date | moment.Moment, format?: 'short' | 'medium' | 'long' | 'full' | string): {
    date: string;
    dayOfWeek: string;
    month: string;
    dayOfMonth: number;
    year: number;
    isWeekend: boolean;
    isToday: boolean;
};
/**
 * Checks if a given timezone string is valid
 */
export declare function isValidTimezone(timezone: string): boolean;
/**
 * Gets all available timezones (useful for debugging)
 */
export declare function getAvailableTimezones(): string[];
/**
 * Format time for voice agent responses
 */
export declare function formatTimeForVoice(timezone: string, format?: '12' | '24'): string;
/**
 * Format date for voice agent responses
 */
export declare function formatDateForVoice(timezone: string, format?: 'short' | 'medium' | 'long'): string;
/**
 * Format date and time for voice agent responses
 */
export declare function formatDateTimeForVoice(timezone: string, options?: {
    timeFormat?: '12' | '24';
    dateFormat?: 'short' | 'medium' | 'long';
}): string;
//# sourceMappingURL=timezoneUtils.d.ts.map