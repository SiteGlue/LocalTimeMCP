import moment from 'moment-timezone';
import { BusinessHours, BusinessType } from './types.js';
/**
 * Holiday information interface
 */
interface HolidayInfo {
    isHoliday: boolean;
    name?: string;
    date?: string;
    type?: string;
    reason?: string;
}
/**
 * Checks if business is currently open and provides detailed information with holiday awareness
 */
export declare function checkBusinessHours(zipCode: string, businessType?: BusinessType): {
    isOpen: boolean;
    nextOpenTime?: string;
    nextOpenDate?: string;
    nextOpenDateTime?: string;
    nextCloseTime?: string;
    nextCloseDate?: string;
    nextCloseDateTime?: string;
    reasoning: string;
    currentTime: string;
    currentDate: string;
    currentDateTime: string;
    businessType: string;
    timezone: string;
    todayHours?: {
        open: string;
        close: string;
        closed?: boolean;
    };
    holidayInfo?: HolidayInfo;
    upcomingHolidays?: Array<{
        name: string;
        date: string;
        daysFromNow: number;
    }>;
};
/**
 * Checks if a specific date is available for appointments
 */
export declare function isDateAvailableForAppointments(date: string | Date | moment.Moment, zipCode: string, businessType?: BusinessType): {
    isAvailable: boolean;
    reason?: string;
    holidayInfo?: HolidayInfo;
};
/**
 * Gets the next available business day for appointments
 */
export declare function getNextAvailableBusinessDay(zipCode: string, businessType?: BusinessType, startDate?: string | Date | moment.Moment): {
    date: string;
    dateTime: string;
    openTime: string;
    closeTime: string;
    daysFromNow: number;
} | null;
/**
 * Gets business hours for a specific business type (for reference)
 */
export declare function getBusinessHoursConfig(businessType: BusinessType): BusinessHours;
/**
 * Formats business hours for voice response with date context and holiday awareness
 */
export declare function formatBusinessHoursForVoice(businessType: BusinessType, timezone?: string): string;
/**
 * Gets a summary of business hours for voice agents with current date and upcoming holidays
 */
export declare function getBusinessHoursSummary(businessType: BusinessType, zipCode?: string): string;
/**
 * Gets detailed date and time information for a postal code with holiday awareness
 */
export declare function getDateTimeInfo(zipCode: string): {
    currentTime: string;
    currentDate: string;
    currentDateTime: string;
    timezone: string;
    dayOfWeek: string;
    isDST: boolean;
    holidayInfo?: HolidayInfo;
    upcomingHolidays?: Array<{
        name: string;
        date: string;
        daysFromNow: number;
    }>;
};
/**
 * Gets all US federal holidays for a given year
 */
export declare function getHolidaysForYear(year: number): Array<{
    name: string;
    date: string;
    type: string;
}>;
export {};
//# sourceMappingURL=buisnessHours.d.ts.map