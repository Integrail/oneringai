/**
 * Microsoft Graph Connector Tools
 *
 * Auto-registers Microsoft tool factories with ConnectorTools.
 * When imported, this module registers factories so that `ConnectorTools.for('microsoft')`
 * automatically includes Microsoft-specific tools alongside the generic API tool.
 *
 * Tools provided:
 * - create_draft_email — Create a draft email or reply draft
 * - send_email — Send an email or reply
 * - create_meeting — Create a calendar event with optional Teams link
 * - edit_meeting — Update an existing calendar event
 * - get_meeting_transcript — Retrieve Teams meeting transcript
 * - find_meeting_slots — Find available meeting time slots
 */

// Side-effect: register Microsoft tool factories with ConnectorTools
import { registerMicrosoftTools } from './register.js';
registerMicrosoftTools();

// Types
export type {
  MicrosoftDraftEmailResult,
  MicrosoftSendEmailResult,
  MicrosoftCreateMeetingResult,
  MicrosoftEditMeetingResult,
  MicrosoftGetTranscriptResult,
  MicrosoftFindSlotsResult,
  MeetingSlotSuggestion,
  MicrosoftAPIError,
} from './types.js';

// Utility functions
export { getUserPathPrefix, microsoftFetch, formatRecipients, isTeamsMeetingUrl, resolveMeetingId } from './types.js';

// Tool factories (for direct use with custom options)
export { createDraftEmailTool } from './createDraftEmail.js';
export { createSendEmailTool } from './sendEmail.js';
export { createMeetingTool } from './createMeeting.js';
export { createEditMeetingTool } from './editMeeting.js';
export { createGetMeetingTranscriptTool } from './getMeetingTranscript.js';
export { createFindMeetingSlotsTool } from './findMeetingSlots.js';
