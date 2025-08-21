import { z } from 'zod';
import { GetBusinessTimeSchema, CheckBusinessHoursSchema, GetTimezoneInfoSchema, ValidationError, TimezoneError } from './types.js';
import { getTimezoneFromPostalCode, getCurrentTimeInTimezone, getCurrentDateInTimezone } from './timezoneUtils.js';
import { checkBusinessHours, getDateTimeInfo } from './buisnessHours.js';
/**
 * Registers all MCP tools for the voice agent server
 */
export function registerTools(server) {
    // Tool 1: Get current business time for a location
    server.registerTool("getBusinessTime", {
        title: "Get Current Business Time",
        description: "Get the current local time and date for a business location using ZIP code or postal code. Perfect for 'What time is it there?' questions.",
        inputSchema: GetBusinessTimeSchema.shape
    }, async ({ zipCode, format = "12" }) => {
        try {
            // Get timezone information
            const { timezone, name: timezoneName } = getTimezoneFromPostalCode(zipCode);
            // Get current time information
            const timeInfo = getCurrentTimeInTimezone(timezone, format);
            // Get current date information
            const dateInfo = getCurrentDateInTimezone(timezone, "medium");
            // Get holiday information
            const dateTimeInfo = getDateTimeInfo(zipCode);
            // Format for voice response
            let formatted = `It is currently ${timeInfo.time} on ${dateInfo.dayOfWeek}, ${dateInfo.date} in the ${zipCode} area.`;
            // Add holiday context if today is a holiday
            if (dateTimeInfo.holidayInfo?.isHoliday) {
                formatted += ` Today is ${dateTimeInfo.holidayInfo.name}.`;
            }
            const result = {
                currentTime: timeInfo.time,
                timezone: timezone,
                isDST: timeInfo.isDST,
                zipCode: zipCode,
                formatted: formatted,
                currentDate: dateInfo.date,
                dayOfWeek: dateInfo.dayOfWeek,
                month: dateInfo.month,
                dayOfMonth: dateInfo.dayOfMonth,
                year: dateInfo.year,
                quarter: dateInfo.quarter,
                weekOfYear: dateInfo.weekOfYear,
                dayOfYear: dateInfo.dayOfYear,
                holidayInfo: dateTimeInfo.holidayInfo,
                upcomingHolidays: dateTimeInfo.upcomingHolidays
            };
            return {
                content: [
                    {
                        type: "text",
                        text: formatted
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = (error instanceof ValidationError || error instanceof TimezoneError)
                ? error.message
                : `Failed to get business time: ${error instanceof Error ? error.message : String(error)}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `I'm sorry, I couldn't determine the time for that location. ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    });
    // Tool 2: Check if business is currently open
    server.registerTool("checkBusinessHours", {
        title: "Check Business Hours Status",
        description: "Determine if a business is currently open based on location and business type. Answers 'Are you open now?' questions with detailed reasoning including holiday awareness.",
        inputSchema: CheckBusinessHoursSchema.shape
    }, async ({ zipCode, businessType = "dental" }) => {
        try {
            const hoursInfo = checkBusinessHours(zipCode, businessType);
            // Create voice-friendly response
            let response = hoursInfo.reasoning;
            if (hoursInfo.isOpen) {
                response = `Yes, we are currently open! ${hoursInfo.reasoning}`;
            }
            else {
                response = `No, we are currently closed. ${hoursInfo.reasoning}`;
            }
            // Add upcoming holiday information if relevant
            if (hoursInfo.upcomingHolidays && hoursInfo.upcomingHolidays.length > 0) {
                const nextHoliday = hoursInfo.upcomingHolidays[0];
                if (nextHoliday.daysFromNow <= 7) {
                    response += ` Please note: ${nextHoliday.name} is coming up on ${nextHoliday.date}, and we will be closed that day.`;
                }
            }
            return {
                content: [
                    {
                        type: "text",
                        text: response
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = (error instanceof ValidationError || error instanceof TimezoneError)
                ? error.message
                : `Failed to check business hours: ${error instanceof Error ? error.message : String(error)}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `I'm sorry, I couldn't check our hours for that location. ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    });
    // Tool 3: Get detailed timezone information
    server.registerTool("getTimezoneInfo", {
        title: "Get Timezone Information",
        description: "Get comprehensive timezone details for a location including DST status, UTC offset, timezone name, detailed date information, and holiday awareness. Useful for scheduling and time coordination.",
        inputSchema: GetTimezoneInfoSchema.shape
    }, async ({ zipCode }) => {
        try {
            const { timezone, name: timezoneName } = getTimezoneFromPostalCode(zipCode);
            const timeInfo = getCurrentTimeInTimezone(timezone, "12");
            const dateInfo = getCurrentDateInTimezone(timezone, "full");
            const dateTimeInfo = getDateTimeInfo(zipCode);
            const dstStatus = timeInfo.isDST ? "observing daylight saving time" : "on standard time";
            let formatted = `The ${zipCode} area is in the ${timezoneName} timezone, currently ${dstStatus}. Today is ${dateInfo.dayOfWeek}, ${dateInfo.date}. The local time is ${timeInfo.time} (UTC${timeInfo.utcOffset}). Additional details: It's day ${dateInfo.dayOfYear} of the year, week ${dateInfo.weekOfYear}, in ${dateInfo.month}, quarter ${dateInfo.quarter} of ${dateInfo.year}.`;
            // Add holiday context
            if (dateTimeInfo.holidayInfo?.isHoliday) {
                formatted += ` Today is ${dateTimeInfo.holidayInfo.name}.`;
            }
            // Add upcoming holidays
            if (dateTimeInfo.upcomingHolidays && dateTimeInfo.upcomingHolidays.length > 0) {
                const nextHoliday = dateTimeInfo.upcomingHolidays[0];
                if (nextHoliday.daysFromNow <= 14) {
                    formatted += ` Upcoming holiday: ${nextHoliday.name} on ${nextHoliday.date} (${nextHoliday.daysFromNow} days from now).`;
                }
            }
            const result = {
                timezone: timezone,
                timezoneName: timezoneName,
                currentTime: timeInfo.time,
                isDST: timeInfo.isDST,
                utcOffset: timeInfo.utcOffset,
                zipCode: zipCode,
                currentDate: dateInfo.date,
                dayOfWeek: dateInfo.dayOfWeek,
                month: dateInfo.month,
                dayOfMonth: dateInfo.dayOfMonth,
                year: dateInfo.year,
                quarter: dateInfo.quarter,
                weekOfYear: dateInfo.weekOfYear,
                dayOfYear: dateInfo.dayOfYear,
                holidayInfo: dateTimeInfo.holidayInfo,
                upcomingHolidays: dateTimeInfo.upcomingHolidays
            };
            return {
                content: [
                    {
                        type: "text",
                        text: formatted
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = (error instanceof ValidationError || error instanceof TimezoneError)
                ? error.message
                : `Failed to get timezone information: ${error instanceof Error ? error.message : String(error)}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `I'm sorry, I couldn't get timezone information for that location. ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    });
    // Tool 4: Check if specific date is available for appointments
    server.registerTool("checkDateAvailability", {
        title: "Check Date Availability",
        description: "Check if a specific date is available for appointments, considering business hours, weekends, and holidays.",
        inputSchema: z.object({
            zipCode: z.string().describe("US zip code or Canadian postal code"),
            date: z.string().describe("Date to check in YYYY-MM-DD format"),
            businessType: z.enum(["dental", "medical", "general"]).optional().default("dental").describe("Type of business")
        }).shape
    }, async ({ zipCode, date, businessType = "dental" }) => {
        try {
            const { isDateAvailableForAppointments } = await import('./buisnessHours.js');
            const availability = isDateAvailableForAppointments(date, zipCode, businessType);
            let response;
            if (availability.isAvailable) {
                response = `Yes, ${date} is available for appointments.`;
            }
            else {
                response = `No, ${date} is not available for appointments. ${availability.reason}`;
            }
            return {
                content: [
                    {
                        type: "text",
                        text: response
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = (error instanceof ValidationError || error instanceof TimezoneError)
                ? error.message
                : `Failed to check date availability: ${error instanceof Error ? error.message : String(error)}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `I'm sorry, I couldn't check availability for that date. ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    });
    // Tool 5: Get next available business day
    server.registerTool("getNextAvailableDay", {
        title: "Get Next Available Business Day",
        description: "Find the next available business day for appointments, automatically excluding weekends and holidays.",
        inputSchema: z.object({
            zipCode: z.string().describe("US zip code or Canadian postal code"),
            businessType: z.enum(["dental", "medical", "general"]).optional().default("dental").describe("Type of business")
        }).shape
    }, async ({ zipCode, businessType = "dental" }) => {
        try {
            const { getNextAvailableBusinessDay } = await import('./buisnessHours.js');
            const nextDay = getNextAvailableBusinessDay(zipCode, businessType);
            let response;
            if (nextDay) {
                if (nextDay.daysFromNow === 0) {
                    response = `Today is available for appointments. We're open from ${nextDay.openTime} to ${nextDay.closeTime}.`;
                }
                else if (nextDay.daysFromNow === 1) {
                    response = `Tomorrow (${nextDay.date}) is available for appointments. We're open from ${nextDay.openTime} to ${nextDay.closeTime}.`;
                }
                else {
                    response = `The next available day for appointments is ${nextDay.date} (${nextDay.daysFromNow} days from now). We're open from ${nextDay.openTime} to ${nextDay.closeTime}.`;
                }
            }
            else {
                response = `I couldn't find an available appointment day in the next 30 days. Please contact us directly.`;
            }
            return {
                content: [
                    {
                        type: "text",
                        text: response
                    }
                ]
            };
        }
        catch (error) {
            const errorMessage = (error instanceof ValidationError || error instanceof TimezoneError)
                ? error.message
                : `Failed to get next available day: ${error instanceof Error ? error.message : String(error)}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `I'm sorry, I couldn't find the next available day. ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    });
}
//# sourceMappingURL=tools.js.map