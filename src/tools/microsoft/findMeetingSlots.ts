/**
 * Microsoft Graph - Find Meeting Slots Tool
 *
 * Find available meeting time slots for a set of attendees.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction, ToolContext } from '../../domain/entities/Tool.js';
import {
  type MicrosoftFindSlotsResult,
  type GraphFindMeetingTimesResponse,
  getUserPathPrefix,
  microsoftFetch,
} from './types.js';

export interface FindMeetingSlotsArgs {
  attendees: string[];
  startDateTime: string;
  endDateTime: string;
  duration: number;
  timeZone?: string;
  maxResults?: number;
  targetUser?: string;
}

/**
 * Create a Microsoft Graph find_meeting_slots tool
 */
export function createFindMeetingSlotsTool(
  connector: Connector,
  userId?: string
): ToolFunction<FindMeetingSlotsArgs, MicrosoftFindSlotsResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'find_meeting_slots',
        description: `Find available meeting time slots when all attendees are free, via Microsoft Graph. Checks each attendee's Outlook calendar and suggests times when everyone is available.

USAGE:
- Provide attendee emails, a search window (start/end datetimes), and desired meeting duration in minutes
- Returns up to maxResults (default: 5) suggested time slots ranked by confidence, with per-attendee availability
- If no slots are found, returns an emptySuggestionsReason explaining why

EXAMPLES:
- Find 30min slot this week: { "attendees": ["alice@contoso.com", "bob@contoso.com"], "startDateTime": "2025-01-15T08:00:00", "endDateTime": "2025-01-15T18:00:00", "duration": 30, "timeZone": "America/New_York" }
- Find 1hr slot across days: { "attendees": ["alice@contoso.com"], "startDateTime": "2025-01-15T08:00:00", "endDateTime": "2025-01-17T18:00:00", "duration": 60, "maxResults": 10 }`,
        parameters: {
          type: 'object',
          properties: {
            attendees: {
              type: 'array',
              items: { type: 'string' },
              description: 'Attendee email addresses to check availability for',
            },
            startDateTime: {
              type: 'string',
              description: 'Search window start in ISO 8601 format (e.g. "2025-01-15T08:00:00")',
            },
            endDateTime: {
              type: 'string',
              description: 'Search window end in ISO 8601 format (e.g. "2025-01-15T18:00:00"). Can span multiple days.',
            },
            duration: {
              type: 'number',
              description: 'Desired meeting duration in minutes (e.g. 30, 60)',
            },
            timeZone: {
              type: 'string',
              description: 'IANA timezone for start/end times (e.g. "America/New_York"). Default: "UTC".',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of time slot suggestions to return. Default: 5.',
            },
            targetUser: {
              type: 'string',
              description: 'User ID or email (UPN) to act on behalf of. Only needed for app-only (client_credentials) auth. Ignored in delegated auth.',
            },
          },
          required: ['attendees', 'startDateTime', 'endDateTime', 'duration'],
        },
      },
    },

    describeCall: (args: FindMeetingSlotsArgs): string => {
      return `Find ${args.duration}min slots for ${args.attendees.length} attendees`;
    },

    permission: {
      scope: 'session',
      riskLevel: 'low',
      approvalMessage: `Find meeting time slots via ${connector.displayName}`,
    },

    execute: async (
      args: FindMeetingSlotsArgs,
      context?: ToolContext
    ): Promise<MicrosoftFindSlotsResult> => {
      const effectiveUserId = context?.userId ?? userId;
      try {
        const prefix = getUserPathPrefix(connector, args.targetUser);
        const tz = args.timeZone ?? 'UTC';

        const result = await microsoftFetch<GraphFindMeetingTimesResponse>(
          connector,
          `${prefix}/findMeetingTimes`,
          {
            method: 'POST',
            userId: effectiveUserId,
            body: {
              attendees: args.attendees.map((email) => ({
                emailAddress: { address: email },
                type: 'required',
              })),
              timeConstraint: {
                timeslots: [
                  {
                    start: { dateTime: args.startDateTime, timeZone: tz },
                    end: { dateTime: args.endDateTime, timeZone: tz },
                  },
                ],
              },
              meetingDuration: `PT${args.duration}M`,
              maxCandidates: args.maxResults ?? 5,
            },
          }
        );

        const slots = (result.meetingTimeSuggestions ?? []).map((s) => ({
          start: s.meetingTimeSlot.start.dateTime,
          end: s.meetingTimeSlot.end.dateTime,
          confidence: String(s.confidence),
          attendeeAvailability: (s.attendeeAvailability ?? []).map((a) => ({
            attendee: a.attendee.emailAddress.address,
            availability: a.availability,
          })),
        }));

        return {
          success: true,
          slots,
          emptySuggestionsReason: result.emptySuggestionsReason,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to find meeting slots: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
