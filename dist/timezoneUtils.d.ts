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
//# sourceMappingURL=timezoneUtils.d.ts.map