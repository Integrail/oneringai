/**
 * Microsoft Graph - Create Meeting Tool
 *
 * Create a calendar event with optional Teams online meeting.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction, ToolContext } from '../../domain/entities/Tool.js';
import {
  type MicrosoftCreateMeetingResult,
  type GraphEventResponse,
  getUserPathPrefix,
  microsoftFetch,
} from './types.js';

export interface CreateMeetingArgs {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  attendees: string[];
  body?: string;
  isOnlineMeeting?: boolean;
  location?: string;
  timeZone?: string;
  targetUser?: string;
}

/**
 * Create a Microsoft Graph create_meeting tool
 */
export function createMeetingTool(
  connector: Connector,
  userId?: string
): ToolFunction<CreateMeetingArgs, MicrosoftCreateMeetingResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'create_meeting',
        description: `Create a calendar event on the user's Outlook calendar via Microsoft Graph, optionally with a Teams online meeting link.

USAGE:
- Provide subject, start/end times (ISO 8601 without timezone suffix — timezone is set separately via the timeZone param), and attendees
- Set isOnlineMeeting: true to generate a Teams meeting link automatically
- Attendees receive an Outlook calendar invitation

EXAMPLES:
- Simple meeting: { "subject": "Standup", "startDateTime": "2025-01-15T09:00:00", "endDateTime": "2025-01-15T09:30:00", "attendees": ["alice@contoso.com"], "timeZone": "America/New_York" }
- Teams meeting: { "subject": "Sprint Review", "startDateTime": "2025-01-15T14:00:00", "endDateTime": "2025-01-15T15:00:00", "attendees": ["alice@contoso.com", "bob@contoso.com"], "isOnlineMeeting": true }
- With location and body: { "subject": "1:1", "startDateTime": "2025-01-15T10:00:00", "endDateTime": "2025-01-15T10:30:00", "attendees": ["alice@contoso.com"], "location": "Room 201", "body": "<p>Weekly sync</p>" }`,
        parameters: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'Meeting title',
            },
            startDateTime: {
              type: 'string',
              description: 'Start date and time in ISO 8601 format (e.g., "2025-01-15T09:00:00")',
            },
            endDateTime: {
              type: 'string',
              description: 'End date and time in ISO 8601 format (e.g., "2025-01-15T09:30:00")',
            },
            attendees: {
              type: 'array',
              items: { type: 'string' },
              description: 'Attendee email addresses',
            },
            body: {
              type: 'string',
              description: 'Meeting description as HTML content (e.g. "<p>Agenda: ...</p>"). Shown in the calendar invitation.',
            },
            isOnlineMeeting: {
              type: 'boolean',
              description: 'When true, generates a Teams online meeting link. Default: false.',
            },
            location: {
              type: 'string',
              description: 'Physical location or room name (e.g. "Conference Room A")',
            },
            timeZone: {
              type: 'string',
              description: 'IANA timezone for start/end times (e.g. "America/New_York", "Europe/London"). Default: "UTC".',
            },
            targetUser: {
              type: 'string',
              description: 'User ID or email (UPN) to act on behalf of. Only needed for app-only (client_credentials) auth. Ignored in delegated auth.',
            },
          },
          required: ['subject', 'startDateTime', 'endDateTime', 'attendees'],
        },
      },
    },

    describeCall: (args: CreateMeetingArgs): string => {
      return `Create meeting: ${args.subject} (${args.attendees.length} attendees)`;
    },

    permission: {
      scope: 'session',
      riskLevel: 'medium',
      approvalMessage: `Create a calendar event via ${connector.displayName}`,
    },

    execute: async (
      args: CreateMeetingArgs,
      context?: ToolContext
    ): Promise<MicrosoftCreateMeetingResult> => {
      const effectiveUserId = context?.userId ?? userId;
      try {
        const prefix = getUserPathPrefix(connector, args.targetUser);
        const tz = args.timeZone ?? 'UTC';

        const eventBody: Record<string, unknown> = {
          subject: args.subject,
          start: { dateTime: args.startDateTime, timeZone: tz },
          end: { dateTime: args.endDateTime, timeZone: tz },
          attendees: args.attendees.map((email) => ({
            emailAddress: { address: email },
            type: 'required',
          })),
        };

        if (args.body) {
          eventBody.body = { contentType: 'HTML', content: args.body };
        }
        if (args.isOnlineMeeting) {
          eventBody.isOnlineMeeting = true;
          eventBody.onlineMeetingProvider = 'teamsForBusiness';
        }
        if (args.location) {
          eventBody.location = { displayName: args.location };
        }

        const event = await microsoftFetch<GraphEventResponse>(
          connector,
          `${prefix}/events`,
          { method: 'POST', userId: effectiveUserId, body: eventBody }
        );

        return {
          success: true,
          eventId: event.id,
          webLink: event.webLink,
          onlineMeetingUrl: event.onlineMeeting?.joinUrl,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create meeting: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
