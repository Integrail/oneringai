/**
 * Microsoft Graph Tools - Shared Types and Helpers
 *
 * Foundation for all Microsoft Graph connector tools.
 * Provides authenticated fetch, delegated/app mode switching, and result types.
 */

import type { Connector } from '../../core/Connector.js';

// ============================================================================
// Delegated / Application Mode
// ============================================================================

/**
 * Get the user path prefix for Microsoft Graph API requests.
 *
 * - OAuth `authorization_code` flow (delegated): returns `/me` (ignores targetUser)
 * - OAuth `client_credentials` flow (application): returns `/users/${targetUser}` (requires targetUser)
 * - API key / other: returns `/me`
 */
export function getUserPathPrefix(connector: Connector, targetUser?: string): string {
  const auth = connector.config.auth;
  if (auth.type === 'oauth' && auth.flow === 'client_credentials') {
    if (!targetUser) {
      throw new Error(
        'targetUser is required when using client_credentials (application) flow. ' +
        'Provide a user ID or UPN (e.g., "user@domain.com").'
      );
    }
    return `/users/${targetUser}`;
  }
  return '/me';
}

// ============================================================================
// Microsoft Graph API Helpers
// ============================================================================

/**
 * Options for microsoftFetch
 */
export interface MicrosoftFetchOptions {
  method?: string;
  body?: unknown;
  userId?: string;
  queryParams?: Record<string, string | number | boolean>;
  accept?: string;
}

/**
 * Error from Microsoft Graph API
 */
export class MicrosoftAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown
  ) {
    const msg = typeof body === 'object' && body !== null && 'error' in body
      ? ((body as { error: { message: string } }).error?.message ?? statusText)
      : statusText;
    super(`Microsoft Graph API error ${status}: ${msg}`);
    this.name = 'MicrosoftAPIError';
  }
}

/**
 * Make an authenticated Microsoft Graph API request through the connector.
 *
 * Adds standard headers and parses JSON response.
 * Handles empty response bodies (e.g., sendMail returns 202 with no body).
 * Throws MicrosoftAPIError on non-ok responses.
 */
export async function microsoftFetch<T = unknown>(
  connector: Connector,
  endpoint: string,
  options?: MicrosoftFetchOptions
): Promise<T> {
  let url = endpoint;

  // Add query params if provided
  if (options?.queryParams && Object.keys(options.queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.queryParams)) {
      params.append(key, String(value));
    }
    url += (url.includes('?') ? '&' : '?') + params.toString();
  }

  const headers: Record<string, string> = {
    'Accept': options?.accept ?? 'application/json',
  };

  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await connector.fetch(
    url,
    {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    },
    options?.userId
  );

  const text = await response.text();

  if (!response.ok) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    throw new MicrosoftAPIError(response.status, response.statusText, data);
  }

  // Handle empty response body (e.g., sendMail returns 202)
  if (!text || text.trim().length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

// ============================================================================
// Utility Helpers
// ============================================================================

/**
 * Convert an array of email addresses to Microsoft Graph recipient format.
 */
export function formatRecipients(emails: string[]): { emailAddress: { address: string } }[] {
  return emails.map((address) => ({ emailAddress: { address } }));
}

/**
 * Parse a meeting ID from a Teams meeting URL or raw meeting ID.
 *
 * Accepts:
 * - Raw meeting IDs (passed through)
 * - Teams meeting URLs: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_...`
 */
export function parseMeetingId(input: string): string {
  if (!input || input.trim().length === 0) {
    throw new Error('Meeting ID cannot be empty');
  }

  const trimmed = input.trim();

  // Try URL format
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'teams.microsoft.com' || url.hostname === 'teams.live.com') {
      const segments = url.pathname.split('/').filter(Boolean);
      // Format: /l/meetup-join/<encoded-thread-id>/<encoded-context>
      const joinIndex = segments.indexOf('meetup-join');
      if (joinIndex >= 0 && segments.length > joinIndex + 1) {
        return decodeURIComponent(segments[joinIndex + 1]!);
      }
    }
  } catch {
    // Not a URL, treat as raw ID
  }

  return trimmed;
}

// ============================================================================
// Result Types
// ============================================================================

export interface MicrosoftDraftEmailResult {
  success: boolean;
  draftId?: string;
  webLink?: string;
  error?: string;
}

export interface MicrosoftSendEmailResult {
  success: boolean;
  error?: string;
}

export interface MicrosoftCreateMeetingResult {
  success: boolean;
  eventId?: string;
  webLink?: string;
  onlineMeetingUrl?: string;
  error?: string;
}

export interface MicrosoftEditMeetingResult {
  success: boolean;
  eventId?: string;
  webLink?: string;
  error?: string;
}

export interface MicrosoftGetTranscriptResult {
  success: boolean;
  transcript?: string;
  meetingSubject?: string;
  error?: string;
}

export interface MicrosoftFindSlotsResult {
  success: boolean;
  slots?: MeetingSlotSuggestion[];
  emptySuggestionsReason?: string;
  error?: string;
}

export interface MeetingSlotSuggestion {
  start: string;
  end: string;
  confidence: string;
  attendeeAvailability: { attendee: string; availability: string }[];
}

// ============================================================================
// Internal Graph API Response Types
// ============================================================================

/** @internal */
export interface GraphMessageResponse {
  id: string;
  webLink?: string;
  subject?: string;
  [key: string]: unknown;
}

/** @internal */
export interface GraphEventResponse {
  id: string;
  webLink?: string;
  subject?: string;
  onlineMeeting?: { joinUrl?: string } | null;
  [key: string]: unknown;
}

/** @internal */
export interface GraphTranscriptListResponse {
  value: { id: string; createdDateTime?: string }[];
}

/** @internal */
export interface GraphFindMeetingTimesResponse {
  meetingTimeSuggestions: {
    confidence: number;
    meetingTimeSlot: {
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
    };
    attendeeAvailability: {
      attendee: { emailAddress: { address: string } };
      availability: string;
    }[];
  }[];
  emptySuggestionsReason?: string;
}
