#!/usr/bin/env node

/**
 * Local Time MCP Server for Vapi Voice Agents
 * Provides accurate local time information based on US/Canada zip/postal codes
 * Optimized for dental practice business hours and call routing
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import moment from 'moment-timezone';
import { AsYouType, getCountryCallingCode } from 'libphonenumber-js';

// Comprehensive zip code to timezone mapping for US and Canada
const ZIP_TIMEZONE_MAP = {
  // US Timezones
  'US': {
    'Eastern': ['0', '1', '2', '3', '4', '5'],
    'Central': ['5', '6', '7', '8'],
    'Mountain': ['8', '9'],
    'Pacific': ['9'],
    'Alaska': ['99'],
    'Hawaii': ['96']
  },
  // Canadian postal code to timezone mapping (first letter)
  'CA': {
    'Newfoundland': ['A'],
    'Atlantic': ['B', 'C', 'E'],
    'Eastern': ['K', 'L', 'M', 'N', 'P'],
    'Central': ['R'],
    'Mountain': ['T'],
    'Pacific': ['V']
  }
};

// Detailed timezone mapping
const TIMEZONE_CODES = {
  'Eastern': 'America/New_York',
  'Central': 'America/Chicago',
  'Mountain': 'America/Denver',
  'Pacific': 'America/Los_Angeles',
  'Alaska': 'America/Anchorage',
  'Hawaii': 'Pacific/Honolulu',
  'Newfoundland': 'America/St_Johns',
  'Atlantic': 'America/Halifax'
};

class LocalTimeMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'local-time-server',
        version: '1.0.0',
        description: 'Provides accurate local time for US/Canada locations for dental practice voice agents'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'getBusinessTime',
          description: 'Get current local time for a business location using zip/postal code. Optimized for dental practice business hours and call routing decisions.',
          inputSchema: {
            type: 'object',
            properties: {
              zipCode: {
                type: 'string',
                description: 'US zip code (5 digits) or Canadian postal code (format: A1A 1A1)',
                pattern: '^(?:[0-9]{5}(?:-[0-9]{4})?|[A-Z][0-9][A-Z]\\s?[0-9][A-Z][0-9])$'
              },
              format: {
                type: 'string',
                description: 'Time format preference',
                enum: ['12-hour', '24-hour'],
                default: '12-hour'
              }
            },
            required: ['zipCode']
          }
        },
        {
          name: 'getTimezoneInfo',
          description: 'Get detailed timezone information including DST status for a location',
          inputSchema: {
            type: 'object',
            properties: {
              zipCode: {
                type: 'string',
                description: 'US zip code or Canadian postal code'
              }
            },
            required: ['zipCode']
          }
        },
        {
          name: 'checkBusinessHours',
          description: 'Check if a business is likely open based on current time and standard dental practice hours',
          inputSchema: {
            type: 'object',
            properties: {
              zipCode: {
                type: 'string',
                description: 'US zip code or Canadian postal code'
              },
              businessType: {
                type: 'string',
                description: 'Type of business for hours estimation',
                enum: ['dental', 'medical', 'general'],
                default: 'dental'
              }
            },
            required: ['zipCode']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'getBusinessTime':
            return await this.getBusinessTime(args.zipCode, args.format || '12-hour');
          
          case 'getTimezoneInfo':
            return await this.getTimezoneInfo(args.zipCode);
          
          case 'checkBusinessHours':
            return await this.checkBusinessHours(args.zipCode, args.businessType || 'dental');
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${error.message}`);
      }
    });
  }

  /**
   * Main function: Get current business time for a location
   */
  async getBusinessTime(zipCode, format = '12-hour') {
    try {
      const cleanZipCode = this.normalizeZipCode(zipCode);
      const timezone = this.zipToTimezone(cleanZipCode);
      const currentTime = moment.tz(timezone);
      
      const timeFormat = format === '24-hour' ? 'HH:mm' : 'h:mm A';
      const formattedTime = currentTime.format(timeFormat);
      const timezoneAbbr = currentTime.format('z');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              localTime: `${formattedTime} ${timezoneAbbr}`,
              timezone: timezone,
              isDST: currentTime.isDST(),
              zipCode: cleanZipCode,
              timestamp: currentTime.unix(),
              date: currentTime.format('YYYY-MM-DD'),
              dayOfWeek: currentTime.format('dddd')
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              zipCode: zipCode
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Get detailed timezone information
   */
  async getTimezoneInfo(zipCode) {
    try {
      const cleanZipCode = this.normalizeZipCode(zipCode);
      const timezone = this.zipToTimezone(cleanZipCode);
      const currentTime = moment.tz(timezone);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              timezone: {
                name: timezone,
                abbreviation: currentTime.format('z'),
                offset: currentTime.format('Z'),
                isDST: currentTime.isDST(),
                utcOffset: currentTime.utcOffset() / 60
              },
              location: {
                zipCode: cleanZipCode,
                country: this.getCountryFromZip(cleanZipCode)
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Check if business is likely open based on current time
   */
  async checkBusinessHours(zipCode, businessType = 'dental') {
    try {
      const cleanZipCode = this.normalizeZipCode(zipCode);
      const timezone = this.zipToTimezone(cleanZipCode);
      const currentTime = moment.tz(timezone);
      
      // Business hours by type
      const businessHours = {
        'dental': { open: 8, close: 17, weekdaysOnly: true },
        'medical': { open: 8, close: 18, weekdaysOnly: false },
        'general': { open: 9, close: 17, weekdaysOnly: true }
      };
      
      const hours = businessHours[businessType] || businessHours['dental'];
      const currentHour = currentTime.hour();
      const dayOfWeek = currentTime.day(); // 0 = Sunday, 6 = Saturday
      
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const isInBusinessHours = currentHour >= hours.open && currentHour < hours.close;
      const isLikelyOpen = hours.weekdaysOnly ? 
        (isWeekday && isInBusinessHours) : 
        isInBusinessHours;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              isLikelyOpen: isLikelyOpen,
              currentTime: currentTime.format('h:mm A z'),
              businessType: businessType,
              analysis: {
                currentHour: currentHour,
                businessHours: `${hours.open}:00 - ${hours.close}:00`,
                isWeekday: isWeekday,
                dayOfWeek: currentTime.format('dddd'),
                reasoning: this.getBusinessHoursReasoning(isLikelyOpen, currentHour, dayOfWeek, hours)
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Normalize zip/postal code format
   */
  normalizeZipCode(zipCode) {
    if (!zipCode || typeof zipCode !== 'string') {
      throw new Error('Invalid zip code format');
    }

    // Remove spaces and convert to uppercase
    const cleaned = zipCode.replace(/\s+/g, '').toUpperCase();
    
    // Validate US zip code (5 or 9 digits)
    if (/^\d{5}(-?\d{4})?$/.test(cleaned)) {
      return cleaned.substring(0, 5); // Return first 5 digits
    }
    
    // Validate Canadian postal code
    if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
      return cleaned;
    }
    
    throw new Error(`Invalid zip/postal code format: ${zipCode}`);
  }

  /**
   * Convert zip/postal code to timezone
   */
  zipToTimezone(zipCode) {
    const country = this.getCountryFromZip(zipCode);
    
    if (country === 'US') {
      return this.getUSTimezone(zipCode);
    } else if (country === 'CA') {
      return this.getCanadianTimezone(zipCode);
    }
    
    throw new Error(`Unsupported location: ${zipCode}`);
  }

  /**
   * Determine country from zip/postal code
   */
  getCountryFromZip(zipCode) {
    if (/^\d{5}(-?\d{4})?$/.test(zipCode)) {
      return 'US';
    } else if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(zipCode)) {
      return 'CA';
    }
    throw new Error(`Cannot determine country for: ${zipCode}`);
  }

  /**
   * Get US timezone from zip code
   */
  getUSTimezone(zipCode) {
    const firstDigit = zipCode.charAt(0);
    const firstTwo = zipCode.substring(0, 2);
    
    // Special cases for better accuracy
    const specialCases = {
      '832': 'America/Chicago', // Houston, TX
      '806': 'America/Chicago', // Lubbock, TX
      '915': 'America/Denver',  // El Paso, TX
      '79': 'America/Denver',   // West Texas
      '88': 'America/Denver',   // New Mexico
      '59': 'America/Denver',   // Montana
      '82': 'America/Denver',   // Wyoming
      '83': 'America/Denver',   // Idaho (southern)
      '97': 'America/Los_Angeles', // Oregon
      '98': 'America/Los_Angeles', // Washington
      '99': 'America/Anchorage' // Alaska
    };
    
    // Check special cases first
    if (specialCases[firstTwo]) {
      return specialCases[firstTwo];
    }
    if (specialCases[firstDigit + zipCode.charAt(1)]) {
      return specialCases[firstDigit + zipCode.charAt(1)];
    }
    
    // General mapping by first digit
    const timezoneMap = {
      '0': 'America/New_York',    // New England
      '1': 'America/New_York',    // Mid-Atlantic
      '2': 'America/New_York',    // Southeast
      '3': 'America/New_York',    // Southeast/South
      '4': 'America/New_York',    // Kentucky, Tennessee
      '5': 'America/Chicago',     // Upper Midwest
      '6': 'America/Chicago',     // Lower Midwest/South
      '7': 'America/Chicago',     // South Central
      '8': 'America/Denver',      // Mountain
      '9': 'America/Los_Angeles'  // Pacific/Alaska/Hawaii
    };
    
    // Hawaii special case
    if (zipCode.startsWith('96') || zipCode.startsWith('967') || zipCode.startsWith('968')) {
      return 'Pacific/Honolulu';
    }
    
    const timezone = timezoneMap[firstDigit];
    if (!timezone) {
      throw new Error(`Cannot determine timezone for US zip code: ${zipCode}`);
    }
    
    return timezone;
  }

  /**
   * Get Canadian timezone from postal code
   */
  getCanadianTimezone(postalCode) {
    const firstLetter = postalCode.charAt(0);
    
    const timezoneMap = {
      'A': 'America/St_Johns',     // Newfoundland
      'B': 'America/Halifax',      // Nova Scotia
      'C': 'America/Halifax',      // Prince Edward Island
      'E': 'America/Halifax',      // New Brunswick
      'G': 'America/Toronto',      // Eastern Quebec
      'H': 'America/Toronto',      // Metropolitan Montreal
      'J': 'America/Toronto',      // Western Quebec
      'K': 'America/Toronto',      // Eastern Ontario
      'L': 'America/Toronto',      // Central Ontario
      'M': 'America/Toronto',      // Metropolitan Toronto
      'N': 'America/Toronto',      // Southwestern Ontario
      'P': 'America/Toronto',      // Northern Ontario
      'R': 'America/Winnipeg',     // Manitoba
      'S': 'America/Regina',       // Saskatchewan
      'T': 'America/Edmonton',     // Alberta
      'V': 'America/Vancouver',    // British Columbia
      'X': 'America/Whitehorse',   // Northwest Territories/Nunavut
      'Y': 'America/Whitehorse'    // Yukon
    };
    
    const timezone = timezoneMap[firstLetter];
    if (!timezone) {
      throw new Error(`Cannot determine timezone for Canadian postal code: ${postalCode}`);
    }
    
    return timezone;
  }

  /**
   * Generate business hours reasoning
   */
  getBusinessHoursReasoning(isOpen, currentHour, dayOfWeek, hours) {
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (hours.weekdaysOnly) {
        return `Closed - ${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}, business operates weekdays only`;
      }
    }
    
    if (currentHour < hours.open) {
      return `Closed - Before business hours (opens at ${hours.open}:00)`;
    }
    
    if (currentHour >= hours.close) {
      return `Closed - After business hours (closes at ${hours.close}:00)`;
    }
    
    return `Open - Within business hours (${hours.open}:00 - ${hours.close}:00)`;
  }

  /**
   * Start the MCP server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Local Time MCP Server running on stdio');
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new LocalTimeMCPServer();
  server.start().catch(console.error);
}

export default LocalTimeMCPServer;