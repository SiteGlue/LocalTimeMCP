import { BusinessHours, BusinessType } from './types.js';
/**
 * Checks if business is currently open and provides detailed information
 */
export declare function checkBusinessHours(zipCode: string, businessType?: BusinessType): {
    isOpen: boolean;
    nextOpenTime?: string;
    nextCloseTime?: string;
    reasoning: string;
    currentTime: string;
    businessType: string;
    todayHours?: {
        open: string;
        close: string;
        closed?: boolean;
    };
};
/**
 * Gets business hours for a specific business type (for reference)
 */
export declare function getBusinessHoursConfig(businessType: BusinessType): BusinessHours;
/**
 * Formats business hours for voice response
 */
export declare function formatBusinessHoursForVoice(businessType: BusinessType): string;
/**
 * Gets a summary of business hours for voice agents
 */
export declare function getBusinessHoursSummary(businessType: BusinessType): string;
//# sourceMappingURL=buisnessHours.d.ts.map