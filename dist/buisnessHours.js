import moment from 'moment-timezone';
import { ValidationError } from './types.js';
import { getTimezoneFromPostalCode } from './timezoneUtils.js';
// Business hours configurations for different business types
const BUSINESS_HOURS_CONFIG = {
    dental: {
        monday: { open: '08:00', close: '17:00' },
        tuesday: { open: '08:00', close: '17:00' },
        wednesday: { open: '08:00', close: '17:00' },
        thursday: { open: '08:00', close: '17:00' },
        friday: { open: '08:00', close: '17:00' },
        saturday: { closed: true, open: '09:00', close: '13:00' },
        sunday: { closed: true, open: '09:00', close: '13:00' }
    },
    medical: {
        monday: { open: '07:00', close: '19:00' },
        tuesday: { open: '07:00', close: '19:00' },
        wednesday: { open: '07:00', close: '19:00' },
        thursday: { open: '07:00', close: '19:00' },
        friday: { open: '07:00', close: '19:00' },
        saturday: { open: '08:00', close: '16:00' },
        sunday: { closed: true, open: '10:00', close: '14:00' }
    },
    general: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '15:00' },
        sunday: { closed: true, open: '12:00', close: '16:00' }
    }
};
/**
 * Gets the day of week in lowercase format
 */
function getDayOfWeek(momentObj) {
    const dayNames = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday'
    };
    return dayNames[momentObj.day()];
}
/**
 * Converts time string (HH:mm) to moment object for the given date
 */
function parseTimeOnDate(date, timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return date.clone().hour(hours).minute(minutes).second(0).millisecond(0);
}
/**
 * Gets the next occurrence of a specific day and time
 */
function getNextOccurrence(currentTime, targetDay, timeStr) {
    const dayNumbers = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
    };
    const targetDayNum = dayNumbers[targetDay];
    const currentDayNum = currentTime.day();
    let daysToAdd = targetDayNum - currentDayNum;
    if (daysToAdd <= 0) {
        daysToAdd += 7; // Next week
    }
    const targetDate = currentTime.clone().add(daysToAdd, 'days');
    return parseTimeOnDate(targetDate, timeStr);
}
/**
 * Finds the next open time for a business
 */
function findNextOpenTime(currentTime, businessType) {
    const config = BUSINESS_HOURS_CONFIG[businessType];
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    // Check today first (if we haven't passed opening time)
    const today = getDayOfWeek(currentTime);
    const todayHours = config[today];
    if (!todayHours.closed) {
        const todayOpen = parseTimeOnDate(currentTime, todayHours.open);
        if (currentTime.isBefore(todayOpen)) {
            return todayOpen;
        }
    }
    // Check next 7 days
    for (let i = 1; i <= 7; i++) {
        const checkDate = currentTime.clone().add(i, 'days');
        const dayName = getDayOfWeek(checkDate);
        const dayHours = config[dayName];
        if (!dayHours.closed) {
            return parseTimeOnDate(checkDate, dayHours.open);
        }
    }
    return null; // Should never happen unless all days are closed
}
/**
 * Finds the next close time for a business
 */
function findNextCloseTime(currentTime, businessType) {
    const config = BUSINESS_HOURS_CONFIG[businessType];
    const today = getDayOfWeek(currentTime);
    const todayHours = config[today];
    // If currently open, return today's close time
    if (!todayHours.closed) {
        const todayClose = parseTimeOnDate(currentTime, todayHours.close);
        if (currentTime.isBefore(todayClose)) {
            return todayClose;
        }
    }
    return null;
}
/**
 * Checks if business is currently open and provides detailed information
 */
export function checkBusinessHours(zipCode, businessType = 'dental') {
    try {
        // Get timezone for the postal code
        const { timezone } = getTimezoneFromPostalCode(zipCode);
        const currentTime = moment.tz(timezone);
        const config = BUSINESS_HOURS_CONFIG[businessType];
        // Get today's hours
        const today = getDayOfWeek(currentTime);
        const todayHours = config[today];
        let isOpen = false;
        let reasoning = '';
        let nextOpenTime;
        let nextCloseTime;
        if (todayHours.closed) {
            isOpen = false;
            reasoning = `We are closed on ${String(today)}s.`;
            const nextOpen = findNextOpenTime(currentTime, businessType);
            if (nextOpen) {
                nextOpenTime = nextOpen.format('dddd [at] h:mm A z');
                reasoning += ` We will be open next on ${nextOpenTime}.`;
            }
        }
        else {
            const openTime = parseTimeOnDate(currentTime, todayHours.open);
            const closeTime = parseTimeOnDate(currentTime, todayHours.close);
            if (currentTime.isBefore(openTime)) {
                isOpen = false;
                nextOpenTime = openTime.format('h:mm A z');
                reasoning = `We are currently closed. We open today at ${nextOpenTime}.`;
            }
            else if (currentTime.isAfter(closeTime)) {
                isOpen = false;
                const nextOpen = findNextOpenTime(currentTime, businessType);
                if (nextOpen) {
                    nextOpenTime = nextOpen.format('dddd [at] h:mm A z');
                    reasoning = `We are currently closed. We closed today at ${closeTime.format('h:mm A z')}. We will be open next on ${nextOpenTime}.`;
                }
            }
            else {
                isOpen = true;
                nextCloseTime = closeTime.format('h:mm A z');
                reasoning = `We are currently open! We close today at ${nextCloseTime}.`;
            }
        }
        return {
            isOpen,
            nextOpenTime,
            nextCloseTime,
            reasoning,
            currentTime: currentTime.format('dddd, MMMM Do YYYY [at] h:mm A z'),
            businessType,
            todayHours: {
                open: todayHours.open,
                close: todayHours.close,
                closed: todayHours.closed
            }
        };
    }
    catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new ValidationError(`Failed to check business hours: ${error}`);
    }
}
/**
 * Gets business hours for a specific business type (for reference)
 */
export function getBusinessHoursConfig(businessType) {
    return BUSINESS_HOURS_CONFIG[businessType];
}
/**
 * Formats business hours for voice response
 */
export function formatBusinessHoursForVoice(businessType) {
    const config = BUSINESS_HOURS_CONFIG[businessType];
    const lines = [];
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of daysOfWeek) {
        const hours = config[day];
        const dayCapitalized = String(day).charAt(0).toUpperCase() + String(day).slice(1);
        if (hours.closed) {
            lines.push(`${dayCapitalized}: Closed`);
        }
        else {
            const openTime = moment(hours.open, 'HH:mm').format('h:mm A');
            const closeTime = moment(hours.close, 'HH:mm').format('h:mm A');
            lines.push(`${dayCapitalized}: ${openTime} to ${closeTime}`);
        }
    }
    return lines.join(', ');
}
/**
 * Gets a summary of business hours for voice agents
 */
export function getBusinessHoursSummary(businessType) {
    const config = BUSINESS_HOURS_CONFIG[businessType];
    // Find typical weekday hours
    const weekdayHours = config.monday;
    const openTime = moment(weekdayHours.open, 'HH:mm').format('h:mm A');
    const closeTime = moment(weekdayHours.close, 'HH:mm').format('h:mm A');
    let summary = `Our typical hours are Monday through Friday, ${openTime} to ${closeTime}.`;
    // Check weekend hours
    const saturdayHours = config.saturday;
    const sundayHours = config.sunday;
    if (!saturdayHours.closed) {
        const satOpen = moment(saturdayHours.open, 'HH:mm').format('h:mm A');
        const satClose = moment(saturdayHours.close, 'HH:mm').format('h:mm A');
        summary += ` Saturday: ${satOpen} to ${satClose}.`;
    }
    else {
        summary += ' We are closed on Saturdays.';
    }
    if (!sundayHours.closed) {
        const sunOpen = moment(sundayHours.open, 'HH:mm').format('h:mm A');
        const sunClose = moment(sundayHours.close, 'HH:mm').format('h:mm A');
        summary += ` Sunday: ${sunOpen} to ${sunClose}.`;
    }
    else {
        summary += ' We are closed on Sundays.';
    }
    return summary;
}
//# sourceMappingURL=buisnessHours.js.map