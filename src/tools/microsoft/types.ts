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
 * Check if a meeting ID input is a Teams join URL.
 *
 * Teams join URLs look like:
 * - `https://teams.microsoft.com/l/meetup-join/19%3ameeting_...`
 * - `https://teams.live.com/l/meetup-join/...`
 *
 * IMPORTANT: A Teams join URL does NOT contain the Graph API meeting ID.
 * To resolve a URL to a meeting ID, use `resolveMeetingId()` which calls
 * `GET /me/onlineMeetings?$filter=JoinWebUrl eq '{url}'`.
 */
export function isTeamsMeetingUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return (
      (url.hostname === 'teams.microsoft.com' || url.hostname === 'teams.live.com') &&
      url.pathname.includes('meetup-join')
    );
  } catch {
    return false;
  }
}

/** @internal Graph API response for onlineMeetings filter query */
export interface GraphOnlineMeetingListResponse {
  value: { id: string; subject?: string; joinWebUrl?: string }[];
}

/**
 * Resolve a meeting input (ID or Teams URL) to a Graph API online meeting ID.
 *
 * - Raw meeting IDs are passed through as-is
 * - Teams join URLs are resolved via `GET /me/onlineMeetings?$filter=JoinWebUrl eq '{url}'`
 *
 * @returns The resolved meeting ID and optional subject
 * @throws Error if the URL cannot be resolved or input is empty
 */
export async function resolveMeetingId(
  connector: Connector,
  input: string,
  prefix: string,
  effectiveUserId?: string
): Promise<{ meetingId: string; subject?: string }> {
  if (!input || input.trim().length === 0) {
    throw new Error('Meeting ID cannot be empty');
  }

  const trimmed = input.trim();

  if (!isTeamsMeetingUrl(trimmed)) {
    return { meetingId: trimmed };
  }

  // Resolve Teams URL to meeting ID via Graph API filter
  const meetings = await microsoftFetch<GraphOnlineMeetingListResponse>(
    connector,
    `${prefix}/onlineMeetings`,
    {
      userId: effectiveUserId,
      queryParams: { '$filter': `JoinWebUrl eq '${trimmed}'` },
    }
  );

  if (!meetings.value || meetings.value.length === 0) {
    throw new Error(
      `Could not find an online meeting matching the provided Teams URL. ` +
      `Make sure the URL is correct and you have access to this meeting.`
    );
  }

  return {
    meetingId: meetings.value[0]!.id,
    subject: meetings.value[0]!.subject,
  };
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
