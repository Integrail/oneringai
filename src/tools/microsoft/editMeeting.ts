/**
 * Microsoft Graph - Edit Meeting Tool
 *
 * Update an existing calendar event.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction, ToolContext } from '../../domain/entities/Tool.js';
import {
  type MicrosoftEditMeetingResult,
  type GraphEventResponse,
  getUserPathPrefix,
  microsoftFetch,
} from './types.js';

export interface EditMeetingArgs {
  eventId: string;
  subject?: string;
  startDateTime?: string;
  endDateTime?: string;
  attendees?: string[];
  body?: string;
  isOnlineMeeting?: boolean;
  location?: string;
  timeZone?: string;
  targetUser?: string;
}

/**
 * Create a Microsoft Graph edit_meeting tool
 */
export function createEditMeetingTool(
  connector: Connector,
  userId?: string
): ToolFunction<EditMeetingArgs, MicrosoftEditMeetingResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'edit_meeting',
        description: `Update an existing Outlook calendar event via Microsoft Graph. Only the fields you provide will be changed — omitted fields keep their current values.

IMPORTANT: The "attendees" field REPLACES the entire attendee list. Include all desired attendees (both new and existing), not just the ones you want to add.

USAGE:
- Provide eventId (from create_meeting result or calendar event) and only the fields to change
- Get the eventId from a previous create_meeting call or from the user's calendar

EXAMPLES:
- Reschedule: { "eventId": "AAMkADI1...", "startDateTime": "2025-01-15T10:00:00", "endDateTime": "2025-01-15T10:30:00", "timeZone": "America/New_York" }
- Change attendees: { "eventId": "AAMkADI1...", "attendees": ["alice@contoso.com", "charlie@contoso.com"] }
- Add Teams link: { "eventId": "AAMkADI1...", "isOnlineMeeting": true }
- Update title: { "eventId": "AAMkADI1...", "subject": "Updated: Sprint Review" }`,
        parameters: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'Calendar event ID to update (from create_meeting result or Graph API, e.g. "AAMkADI1...")',
            },
            subject: {
              type: 'string',
              description: 'New meeting title',
            },
            startDateTime: {
              type: 'string',
              description: 'New start date and time in ISO 8601 format',
            },
            endDateTime: {
              type: 'string',
              description: 'New end date and time in ISO 8601 format',
            },
            attendees: {
              type: 'array',
              items: { type: 'string' },
              description: 'Full replacement attendee list (email addresses). Include ALL desired attendees, not just new ones.',
            },
            body: {
              type: 'string',
              description: 'New meeting description as HTML content',
            },
            isOnlineMeeting: {
              type: 'boolean',
              description: 'Set to true to add a Teams meeting link, or false to remove it',
            },
            location: {
              type: 'string',
              description: 'New physical location or room name',
            },
            timeZone: {
              type: 'string',
              description: 'IANA timezone for start/end times (e.g. "America/New_York"). Default: "UTC".',
            },
            targetUser: {
              type: 'string',
              description: 'User ID or email (UPN) to act on behalf of. Only needed for app-only (client_credentials) auth. Ignored in delegated auth.',
            },
          },
          required: ['eventId'],
        },
      },
    },

    describeCall: (args: EditMeetingArgs): string => {
      const fields = ['subject', 'startDateTime', 'endDateTime', 'attendees', 'body', 'location'] as const;
      const changed = fields.filter((f) => args[f] !== undefined);
      return `Edit meeting ${args.eventId.slice(0, 12)}... (${changed.join(', ') || 'no changes'})`;
    },

    permission: {
      scope: 'session',
      riskLevel: 'medium',
      approvalMessage: `Update a calendar event via ${connector.displayName}`,
    },

    execute: async (
      args: EditMeetingArgs,
      context?: ToolContext
    ): Promise<MicrosoftEditMeetingResult> => {
      const effectiveUserId = context?.userId ?? userId;
      try {
        const prefix = getUserPathPrefix(connector, args.targetUser);
        const tz = args.timeZone ?? 'UTC';

        // Build partial update body with only provided fields
        const patchBody: Record<string, unknown> = {};

        if (args.subject !== undefined) patchBody.subject = args.subject;
        if (args.body !== undefined) patchBody.body = { contentType: 'HTML', content: args.body };
        if (args.startDateTime !== undefined) patchBody.start = { dateTime: args.startDateTime, timeZone: tz };
        if (args.endDateTime !== undefined) patchBody.end = { dateTime: args.endDateTime, timeZone: tz };
        if (args.attendees !== undefined) {
          patchBody.attendees = args.attendees.map((email) => ({
            emailAddress: { address: email },
            type: 'required',
          }));
        }
        if (args.isOnlineMeeting !== undefined) {
          patchBody.isOnlineMeeting = args.isOnlineMeeting;
          if (args.isOnlineMeeting) {
            patchBody.onlineMeetingProvider = 'teamsForBusiness';
          }
        }
        if (args.location !== undefined) {
          patchBody.location = { displayName: args.location };
        }

        const event = await microsoftFetch<GraphEventResponse>(
          connector,
          `${prefix}/events/${args.eventId}`,
          { method: 'PATCH', userId: effectiveUserId, body: patchBody }
        );

        return {
          success: true,
          eventId: event.id,
          webLink: event.webLink,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to edit meeting: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
