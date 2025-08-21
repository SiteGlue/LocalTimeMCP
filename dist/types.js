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
// Error types
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
export class TimezoneError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimezoneError';
    }
}
//# sourceMappingURL=types.js.map