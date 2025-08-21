import moment from 'moment-timezone';
import Holidays from 'date-holidays'; // npm install date-holidays
import { BusinessHours, BusinessType, ValidationError } from './types.js';
import { getTimezoneFromPostalCode } from './timezoneUtils.js';

// Business hours configurations for different business types
const BUSINESS_HOURS_CONFIG: Record<BusinessType, BusinessHours> = {
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

// Initialize US holidays
const usHolidays = new Holidays('US');

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
 * Gets the day of week in lowercase format
 */
function getDayOfWeek(momentObj: moment.Moment): keyof BusinessHours {
  const dayNames: Record<number, keyof BusinessHours> = {
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
function parseTimeOnDate(date: moment.Moment, timeStr: string): moment.Moment {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return date.clone().hour(hours).minute(minutes).second(0).millisecond(0);
}

/**
 * Checks if a date is a US federal holiday
 */
function checkHoliday(date: moment.Moment | Date | string, timezone?: string): HolidayInfo {
  try {
    let checkDate: Date;
    
    if (moment.isMoment(date)) {
      checkDate = date.toDate();
    } else if (date instanceof Date) {
      checkDate = date;
    } else {
      // String date - convert using timezone if provided
      const momentDate = timezone ? moment.tz(date, timezone) : moment(date);
      checkDate = momentDate.toDate();
    }
    
    const holidays = usHolidays.getHolidays(checkDate.getFullYear());
    const holidayMatch = holidays.find(holiday => {
      const holidayDate = new Date(holiday.date);
      return (
        holidayDate.getFullYear() === checkDate.getFullYear() &&
        holidayDate.getMonth() === checkDate.getMonth() &&
        holidayDate.getDate() === checkDate.getDate()
      );
    });
    
    if (holidayMatch) {
      return {
        isHoliday: true,
        name: holidayMatch.name,
        date: moment(holidayMatch.date).format('MMMM Do, YYYY'),
        type: holidayMatch.type || 'public',
        reason: `We are closed for ${holidayMatch.name}.`
      };
    }
    
    return { isHoliday: false };
  } catch (error) {
    console.warn('Error checking holiday:', error);
    return { isHoliday: false };
  }
}

/**
 * Checks if a date is a business day (not weekend or holiday)
 */
function isBusinessDay(date: moment.Moment, businessType: BusinessType): {
  isBusinessDay: boolean;
  reason?: string;
} {
  const dayOfWeek = getDayOfWeek(date);
  const config = BUSINESS_HOURS_CONFIG[businessType];
  const dayConfig = config[dayOfWeek];
  
  // Check if closed on this day of week
  if (dayConfig.closed) {
    return {
      isBusinessDay: false,
      reason: `We are closed on ${dayOfWeek}s.`
    };
  }
  
  // Check if it's a holiday
  const holidayInfo = checkHoliday(date);
  if (holidayInfo.isHoliday) {
    return {
      isBusinessDay: false,
      reason: holidayInfo.reason
    };
  }
  
  return { isBusinessDay: true };
}

/**
 * Gets the next occurrence of a specific day and time
 */
function getNextOccurrence(currentTime: moment.Moment, targetDay: keyof BusinessHours, timeStr: string): moment.Moment {
  const dayNumbers: Record<keyof BusinessHours, number> = {
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
 * Finds the next open time for a business, excluding holidays
 */
function findNextOpenTime(currentTime: moment.Moment, businessType: BusinessType): moment.Moment | null {
  const config = BUSINESS_HOURS_CONFIG[businessType];
  
  // Check today first (if we haven't passed opening time)
  const today = getDayOfWeek(currentTime);
  const todayHours = config[today];
  
  if (!todayHours.closed) {
    const todayOpen = parseTimeOnDate(currentTime, todayHours.open);
    if (currentTime.isBefore(todayOpen)) {
      // Check if today is a business day (not a holiday)
      const businessDayCheck = isBusinessDay(currentTime, businessType);
      if (businessDayCheck.isBusinessDay) {
        return todayOpen;
      }
    }
  }
  
  // Check next 14 days (to account for holiday periods)
  for (let i = 1; i <= 14; i++) {
    const checkDate = currentTime.clone().add(i, 'days');
    const dayName = getDayOfWeek(checkDate);
    const dayHours = config[dayName];
    
    if (!dayHours.closed) {
      const businessDayCheck = isBusinessDay(checkDate, businessType);
      if (businessDayCheck.isBusinessDay) {
        return parseTimeOnDate(checkDate, dayHours.open);
      }
    }
  }
  
  return null;
}

/**
 * Finds the next close time for a business
 */
function findNextCloseTime(currentTime: moment.Moment, businessType: BusinessType): moment.Moment | null {
  const config = BUSINESS_HOURS_CONFIG[businessType];
  const today = getDayOfWeek(currentTime);
  const todayHours = config[today];
  
  // If currently open and not a holiday, return today's close time
  if (!todayHours.closed) {
    const todayClose = parseTimeOnDate(currentTime, todayHours.close);
    if (currentTime.isBefore(todayClose)) {
      const businessDayCheck = isBusinessDay(currentTime, businessType);
      if (businessDayCheck.isBusinessDay) {
        return todayClose;
      }
    }
  }
  
  return null;
}

/**
 * Gets upcoming holidays in the next 30 days
 */
function getUpcomingHolidays(currentTime: moment.Moment, daysAhead: number = 30): Array<{
  name: string;
  date: string;
  daysFromNow: number;
}> {
  const holidays = usHolidays.getHolidays(currentTime.year());
  const nextYearHolidays = usHolidays.getHolidays(currentTime.year() + 1);
  const allHolidays = [...holidays, ...nextYearHolidays];
  
  const upcoming = allHolidays
    .map(holiday => {
      const holidayMoment = moment(holiday.date);
      const daysFromNow = holidayMoment.diff(currentTime, 'days');
      return {
        name: holiday.name,
        date: holidayMoment.format('dddd, MMMM Do YYYY'),
        daysFromNow
      };
    })
    .filter(holiday => holiday.daysFromNow >= 0 && holiday.daysFromNow <= daysAhead)
    .sort((a, b) => a.daysFromNow - b.daysFromNow);
  
  return upcoming;
}

/**
 * Checks if business is currently open and provides detailed information with holiday awareness
 */
export function checkBusinessHours(
  zipCode: string, 
  businessType: BusinessType = 'dental'
): {
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
  todayHours?: { open: string; close: string; closed?: boolean };
  holidayInfo?: HolidayInfo;
  upcomingHolidays?: Array<{ name: string; date: string; daysFromNow: number }>;
} {
  try {
    // Get timezone for the postal code
    const { timezone } = getTimezoneFromPostalCode(zipCode);
    const currentTime = moment.tz(timezone);
    const config = BUSINESS_HOURS_CONFIG[businessType];
    
    // Check if today is a holiday
    const todayHolidayInfo = checkHoliday(currentTime);
    
    // Get today's hours
    const today = getDayOfWeek(currentTime);
    const todayHours = config[today];
    
    let isOpen = false;
    let reasoning = '';
    let nextOpenTime: string | undefined;
    let nextOpenDate: string | undefined;
    let nextOpenDateTime: string | undefined;
    let nextCloseTime: string | undefined;
    let nextCloseDate: string | undefined;
    let nextCloseDateTime: string | undefined;
    
    // Check if today is a holiday first
    if (todayHolidayInfo.isHoliday) {
      isOpen = false;
      reasoning = todayHolidayInfo.reason || `We are closed for ${todayHolidayInfo.name}.`;
      
      const nextOpen = findNextOpenTime(currentTime, businessType);
      if (nextOpen) {
        nextOpenTime = nextOpen.format('h:mm A z');
        nextOpenDate = nextOpen.format('dddd, MMMM Do YYYY');
        nextOpenDateTime = nextOpen.format('dddd, MMMM Do YYYY [at] h:mm A z');
        reasoning += ` We will be open next on ${nextOpenDateTime}.`;
      }
    } else if (todayHours.closed) {
      isOpen = false;
      reasoning = `We are closed on ${String(today)}s.`;
      
      const nextOpen = findNextOpenTime(currentTime, businessType);
      if (nextOpen) {
        nextOpenTime = nextOpen.format('h:mm A z');
        nextOpenDate = nextOpen.format('dddd, MMMM Do YYYY');
        nextOpenDateTime = nextOpen.format('dddd, MMMM Do YYYY [at] h:mm A z');
        reasoning += ` We will be open next on ${nextOpenDateTime}.`;
      }
    } else {
      const openTime = parseTimeOnDate(currentTime, todayHours.open);
      const closeTime = parseTimeOnDate(currentTime, todayHours.close);
      
      if (currentTime.isBefore(openTime)) {
        isOpen = false;
        nextOpenTime = openTime.format('h:mm A z');
        nextOpenDate = openTime.format('dddd, MMMM Do YYYY');
        nextOpenDateTime = openTime.format('dddd, MMMM Do YYYY [at] h:mm A z');
        reasoning = `We are currently closed. We open today (${nextOpenDate}) at ${nextOpenTime}.`;
      } else if (currentTime.isAfter(closeTime)) {
        isOpen = false;
        const nextOpen = findNextOpenTime(currentTime, businessType);
        if (nextOpen) {
          nextOpenTime = nextOpen.format('h:mm A z');
          nextOpenDate = nextOpen.format('dddd, MMMM Do YYYY');
          nextOpenDateTime = nextOpen.format('dddd, MMMM Do YYYY [at] h:mm A z');
          reasoning = `We are currently closed. We closed today at ${closeTime.format('h:mm A z')}. We will be open next on ${nextOpenDateTime}.`;
        }
      } else {
        isOpen = true;
        nextCloseTime = closeTime.format('h:mm A z');
        nextCloseDate = closeTime.format('dddd, MMMM Do YYYY');
        nextCloseDateTime = closeTime.format('dddd, MMMM Do YYYY [at] h:mm A z');
        reasoning = `We are currently open! We close today (${closeTime.format('MMMM Do')}) at ${nextCloseTime}.`;
      }
    }
    
    // Get upcoming holidays for additional context
    const upcomingHolidays = getUpcomingHolidays(currentTime, 30);
    
    return {
      isOpen,
      nextOpenTime,
      nextOpenDate,
      nextOpenDateTime,
      nextCloseTime,
      nextCloseDate,
      nextCloseDateTime,
      reasoning,
      currentTime: currentTime.format('h:mm A z'),
      currentDate: currentTime.format('dddd, MMMM Do YYYY'),
      currentDateTime: currentTime.format('dddd, MMMM Do YYYY [at] h:mm A z'),
      businessType,
      timezone,
      todayHours: {
        open: todayHours.open,
        close: todayHours.close,
        closed: todayHours.closed
      },
      holidayInfo: todayHolidayInfo.isHoliday ? todayHolidayInfo : undefined,
      upcomingHolidays: upcomingHolidays.length > 0 ? upcomingHolidays : undefined
    };
    
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to check business hours: ${error}`);
  }
}

/**
 * Checks if a specific date is available for appointments
 */
export function isDateAvailableForAppointments(
  date: string | Date | moment.Moment,
  zipCode: string,
  businessType: BusinessType = 'dental'
): {
  isAvailable: boolean;
  reason?: string;
  holidayInfo?: HolidayInfo;
} {
  try {
    const { timezone } = getTimezoneFromPostalCode(zipCode);
    const checkDate = moment.tz(date, timezone);
    
    const businessDayCheck = isBusinessDay(checkDate, businessType);
    
    if (!businessDayCheck.isBusinessDay) {
      const holidayInfo = checkHoliday(checkDate);
      return {
        isAvailable: false,
        reason: businessDayCheck.reason,
        holidayInfo: holidayInfo.isHoliday ? holidayInfo : undefined
      };
    }
    
    return { isAvailable: true };
  } catch (error) {
    throw new ValidationError(`Failed to check date availability: ${error}`);
  }
}

/**
 * Gets the next available business day for appointments
 */
export function getNextAvailableBusinessDay(
  zipCode: string,
  businessType: BusinessType = 'dental',
  startDate?: string | Date | moment.Moment
): {
  date: string;
  dateTime: string;
  openTime: string;
  closeTime: string;
  daysFromNow: number;
} | null {
  try {
    const { timezone } = getTimezoneFromPostalCode(zipCode);
    const currentTime = startDate ? moment.tz(startDate, timezone) : moment.tz(timezone);
    const config = BUSINESS_HOURS_CONFIG[businessType];
    
    // Check next 30 days
    for (let i = 0; i <= 30; i++) {
      const checkDate = currentTime.clone().add(i, 'days');
      const businessDayCheck = isBusinessDay(checkDate, businessType);
      
      if (businessDayCheck.isBusinessDay) {
        const dayName = getDayOfWeek(checkDate);
        const dayHours = config[dayName];
        
        if (!dayHours.closed) {
          const openTime = parseTimeOnDate(checkDate, dayHours.open);
          const closeTime = parseTimeOnDate(checkDate, dayHours.close);
          
          return {
            date: checkDate.format('dddd, MMMM Do YYYY'),
            dateTime: checkDate.format('dddd, MMMM Do YYYY [at] h:mm A z'),
            openTime: openTime.format('h:mm A z'),
            closeTime: closeTime.format('h:mm A z'),
            daysFromNow: i
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    throw new ValidationError(`Failed to get next available business day: ${error}`);
  }
}

/**
 * Gets business hours for a specific business type (for reference)
 */
export function getBusinessHoursConfig(businessType: BusinessType): BusinessHours {
  return BUSINESS_HOURS_CONFIG[businessType];
}

/**
 * Formats business hours for voice response with date context and holiday awareness
 */
export function formatBusinessHoursForVoice(businessType: BusinessType, timezone?: string): string {
  const config = BUSINESS_HOURS_CONFIG[businessType];
  const lines: string[] = [];
  
  const daysOfWeek: (keyof BusinessHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // Add current date context if timezone provided
  if (timezone) {
    const currentTime = moment.tz(timezone);
    const todayHoliday = checkHoliday(currentTime);
    
    lines.push(`Today is ${currentTime.format('dddd, MMMM Do YYYY')}.`);
    
    if (todayHoliday.isHoliday) {
      lines.push(`Today is ${todayHoliday.name}, so we are closed.`);
    }
  }
  
  for (const day of daysOfWeek) {
    const hours = config[day];
    const dayCapitalized = String(day).charAt(0).toUpperCase() + String(day).slice(1);
    
    if (hours.closed) {
      lines.push(`${dayCapitalized}: Closed`);
    } else {
      const openTime = moment(hours.open, 'HH:mm').format('h:mm A');
      const closeTime = moment(hours.close, 'HH:mm').format('h:mm A');
      lines.push(`${dayCapitalized}: ${openTime} to ${closeTime}`);
    }
  }
  
  return lines.join(', ');
}

/**
 * Gets a summary of business hours for voice agents with current date and upcoming holidays
 */
export function getBusinessHoursSummary(businessType: BusinessType, zipCode?: string): string {
  const config = BUSINESS_HOURS_CONFIG[businessType];
  
  // Add current date/time context if zipCode provided
  let dateContext = '';
  let holidayContext = '';
  
  if (zipCode) {
    try {
      const { timezone } = getTimezoneFromPostalCode(zipCode);
      const currentTime = moment.tz(timezone);
      const todayHoliday = checkHoliday(currentTime);
      const upcomingHolidays = getUpcomingHolidays(currentTime, 7);
      
      dateContext = `Today is ${currentTime.format('dddd, MMMM Do YYYY')} and it's currently ${currentTime.format('h:mm A z')}. `;
      
      if (todayHoliday.isHoliday) {
        holidayContext = `Today is ${todayHoliday.name}, so we are closed today. `;
      } else if (upcomingHolidays.length > 0) {
        const nextHoliday = upcomingHolidays[0];
        holidayContext = `Please note: ${nextHoliday.name} is coming up on ${nextHoliday.date}, and we will be closed that day. `;
      }
    } catch (error) {
      // If we can't get timezone, continue without date context
    }
  }
  
  // Find typical weekday hours
  const weekdayHours = config.monday;
  const openTime = moment(weekdayHours.open, 'HH:mm').format('h:mm A');
  const closeTime = moment(weekdayHours.close, 'HH:mm').format('h:mm A');
  
  let summary = `${dateContext}${holidayContext}Our typical hours are Monday through Friday, ${openTime} to ${closeTime}.`;
  
  // Check weekend hours
  const saturdayHours = config.saturday;
  const sundayHours = config.sunday;
  
  if (!saturdayHours.closed) {
    const satOpen = moment(saturdayHours.open, 'HH:mm').format('h:mm A');
    const satClose = moment(saturdayHours.close, 'HH:mm').format('h:mm A');
    summary += ` Saturday: ${satOpen} to ${satClose}.`;
  } else {
    summary += ' We are closed on Saturdays.';
  }
  
  if (!sundayHours.closed) {
    const sunOpen = moment(sundayHours.open, 'HH:mm').format('h:mm A');
    const sunClose = moment(sundayHours.close, 'HH:mm').format('h:mm A');
    summary += ` Sunday: ${sunOpen} to ${sunClose}.`;
  } else {
    summary += ' We are closed on Sundays.';
  }
  
  return summary;
}

/**
 * Gets detailed date and time information for a postal code with holiday awareness
 */
export function getDateTimeInfo(zipCode: string): {
  currentTime: string;
  currentDate: string;
  currentDateTime: string;
  timezone: string;
  dayOfWeek: string;
  isDST: boolean;
  holidayInfo?: HolidayInfo;
  upcomingHolidays?: Array<{ name: string; date: string; daysFromNow: number }>;
} {
  try {
    const { timezone } = getTimezoneFromPostalCode(zipCode);
    const currentTime = moment.tz(timezone);
    const todayHoliday = checkHoliday(currentTime);
    const upcomingHolidays = getUpcomingHolidays(currentTime, 30);
    
    return {
      currentTime: currentTime.format('h:mm A z'),
      currentDate: currentTime.format('dddd, MMMM Do YYYY'),
      currentDateTime: currentTime.format('dddd, MMMM Do YYYY [at] h:mm A z'),
      timezone,
      dayOfWeek: currentTime.format('dddd'),
      isDST: currentTime.isDST(),
      holidayInfo: todayHoliday.isHoliday ? todayHoliday : undefined,
      upcomingHolidays: upcomingHolidays.length > 0 ? upcomingHolidays : undefined
    };
  } catch (error) {
    throw new ValidationError(`Failed to get date/time info: ${error}`);
  }
}

/**
 * Gets all US federal holidays for a given year
 */
export function getHolidaysForYear(year: number): Array<{
  name: string;
  date: string;
  type: string;
}> {
  try {
    const holidays = usHolidays.getHolidays(year);
    return holidays.map(holiday => ({
      name: holiday.name,
      date: moment(holiday.date).format('dddd, MMMM Do YYYY'),
      type: holiday.type || 'public'
    }));
  } catch (error) {
    throw new ValidationError(`Failed to get holidays for year ${year}: ${error}`);
  }
}
