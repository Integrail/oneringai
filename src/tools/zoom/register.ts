/**
 * Zoom Tools Registration
 *
 * Registers Zoom-specific tool factory with ConnectorTools.
 * When a connector with serviceType 'zoom' (or baseURL matching zoom.us)
 * is used, these tools become available automatically.
 */

import { ConnectorTools } from '../connector/ConnectorTools.js';
import type { Connector } from '../../core/Connector.js';
import { createCreateMeetingTool } from './createMeeting.js';
import { createUpdateMeetingTool } from './updateMeeting.js';
import { createGetTranscriptTool } from './getTranscript.js';

/**
 * Register Zoom tools with the ConnectorTools framework.
 *
 * After calling this, `ConnectorTools.for('my-zoom-connector')` will
 * return all 3 Zoom tools plus the generic API tool.
 */
export function registerZoomTools(): void {
  ConnectorTools.registerService('zoom', (connector: Connector, userId?: string) => {
    return [
      createCreateMeetingTool(connector, userId),
      createUpdateMeetingTool(connector, userId),
      createGetTranscriptTool(connector, userId),
    ];
  });
}
