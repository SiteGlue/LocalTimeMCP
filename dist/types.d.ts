import { z } from 'zod';
export declare const GetBusinessTimeSchema: z.ZodObject<{
    zipCode: z.ZodString;
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["12", "24"]>>>;
}, "strip", z.ZodTypeAny, {
    zipCode: string;
    format: "12" | "24";
}, {
    zipCode: string;
    format?: "12" | "24" | undefined;
}>;
export declare const CheckBusinessHoursSchema: z.ZodObject<{
    zipCode: z.ZodString;
    businessType: z.ZodDefault<z.ZodOptional<z.ZodEnum<["dental", "medical", "general"]>>>;
}, "strip", z.ZodTypeAny, {
    zipCode: string;
    businessType: "dental" | "medical" | "general";
}, {
    zipCode: string;
    businessType?: "dental" | "medical" | "general" | undefined;
}>;
export declare const GetTimezoneInfoSchema: z.ZodObject<{
    zipCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    zipCode: string;
}, {
    zipCode: string;
}>;
export interface BusinessHours {
    monday: {
        open: string;
        close: string;
        closed?: boolean;
    };
    tuesday: {
        open: string;
        close: string;
        closed?: boolean;
    };
    wednesday: {
        open: string;
        close: string;
        closed?: boolean;
    };
    thursday: {
        open: string;
        close: string;
        closed?: boolean;
    };
    friday: {
        open: string;
        close: string;
        closed?: boolean;
    };
    saturday: {
        open: string;
        close: string;
        closed?: boolean;
    };
    sunday: {
        open: string;
        close: string;
        closed?: boolean;
    };
}
export interface TimezoneMapping {
    timezone: string;
    name: string;
}
export interface BusinessTimeResult {
    currentTime: string;
    timezone: string;
    isDST: boolean;
    zipCode: string;
    formatted: string;
}
export interface BusinessHoursResult {
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
}
export interface TimezoneInfoResult {
    timezone: string;
    timezoneName: string;
    currentTime: string;
    isDST: boolean;
    utcOffset: string;
    zipCode: string;
}
export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare class TimezoneError extends Error {
    constructor(message: string);
}
export type BusinessType = z.infer<typeof CheckBusinessHoursSchema>['businessType'];
export type GetBusinessTimeInput = z.infer<typeof GetBusinessTimeSchema>;
export type CheckBusinessHoursInput = z.infer<typeof CheckBusinessHoursSchema>;
export type GetTimezoneInfoInput = z.infer<typeof GetTimezoneInfoSchema>;
export {};
//# sourceMappingURL=types.d.ts.map