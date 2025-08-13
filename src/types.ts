import { z } from 'zod';

// Input schemas for tools
export const GetBusinessTimeSchema = z.object({
  zipCode: z.string().describe("US zip code or Canadian postal code"),
  format: z.enum(["12", "24"]).optional().default("12").describe("Time format: 12-hour or 24-hour")
});

export const CheckBusinessHoursSchema = z.object({
  zipCode: z.string().describe("US zip code or Canadian postal code"),
  businessType: z.enum(["dental", "medical", "general"]).optional().default("dental").describe("Type of business for hours calculation")
});

export const GetTimezoneInfoSchema = z.object({
  zipCode: z.string().describe("US zip code or Canadian postal code")
});

// Business hours configuration
export interface BusinessHours {
  monday: { open: string; close: string; closed?: boolean };
  tuesday: { open: string; close: string; closed?: boolean };
  wednesday: { open: string; close: string; closed?: boolean };
  thursday: { open: string; close: string; closed?: boolean };
  friday: { open: string; close: string; closed?: boolean };
  saturday: { open: string; close: string; closed?: boolean };
  sunday: { open: string; close: string; closed?: boolean };
}

// Timezone mapping interfaces
export interface TimezoneMapping {
  timezone: string;
  name: string;
}

// Tool result types
export interface BusinessTimeResult {
  currentTime: string;
  timezone: string;
  isDST: boolean;
  zipCode: string;
  formatted: string;
  // New date fields
  currentDate: string;
  dayOfWeek: string;
  month: string;
  dayOfMonth: number;
  year: number;
  quarter: number;
  weekOfYear: number;
  dayOfYear: number;
}

export interface BusinessHoursResult {
  isOpen: boolean;
  nextOpenTime?: string;
  nextCloseTime?: string;
  reasoning: string;
  currentTime: string;
  businessType: string;
  todayHours?: { open: string; close: string; closed?: boolean };
}

export interface TimezoneInfoResult {
  timezone: string;
  timezoneName: string;
  currentTime: string;
  isDST: boolean;
  utcOffset: string;
  zipCode: string;
  // New date fields
  currentDate: string;
  dayOfWeek: string;
  month: string;
  dayOfMonth: number;
  year: number;
  quarter: number;
  weekOfYear: number;
  dayOfYear: number;
}

// Error types
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TimezoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimezoneError';
  }
}

export type BusinessType = z.infer<typeof CheckBusinessHoursSchema>['businessType'];
export type GetBusinessTimeInput = z.infer<typeof GetBusinessTimeSchema>;
export type CheckBusinessHoursInput = z.infer<typeof CheckBusinessHoursSchema>;
export type GetTimezoneInfoInput = z.infer<typeof GetTimezoneInfoSchema>;

// Explicit export declaration for module recognition
export {};
