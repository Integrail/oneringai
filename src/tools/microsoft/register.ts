/**
 * Microsoft Graph Tools Registration
 *
 * Registers Microsoft-specific tool factory with ConnectorTools.
 * When a connector with serviceType 'microsoft' (or baseURL matching graph.microsoft.com)
 * is used, these tools become available automatically.
 */

import { ConnectorTools } from '../connector/ConnectorTools.js';
import type { Connector } from '../../core/Connector.js';
import { createDraftEmailTool } from './createDraftEmail.js';
import { createSendEmailTool } from './sendEmail.js';
import { createMeetingTool } from './createMeeting.js';
import { createEditMeetingTool } from './editMeeting.js';
import { createGetMeetingTranscriptTool } from './getMeetingTranscript.js';
import { createFindMeetingSlotsTool } from './findMeetingSlots.js';
import { createMicrosoftReadFileTool } from './readFile.js';
import { createMicrosoftListFilesTool } from './listFiles.js';
import { createMicrosoftSearchFilesTool } from './searchFiles.js';

/**
 * Register Microsoft Graph tools with the ConnectorTools framework.
 *
 * After calling this, `ConnectorTools.for('my-microsoft-connector')` will
 * return all 9 Microsoft tools plus the generic API tool.
 */
export function registerMicrosoftTools(): void {
  ConnectorTools.registerService('microsoft', (connector: Connector, userId?: string) => {
    return [
      // Email
      createDraftEmailTool(connector, userId),
      createSendEmailTool(connector, userId),
      // Meetings
      createMeetingTool(connector, userId),
      createEditMeetingTool(connector, userId),
      createGetMeetingTranscriptTool(connector, userId),
      createFindMeetingSlotsTool(connector, userId),
      // Files (OneDrive / SharePoint)
      createMicrosoftReadFileTool(connector, userId),
      createMicrosoftListFilesTool(connector, userId),
      createMicrosoftSearchFilesTool(connector, userId),
    ];
  });
}
