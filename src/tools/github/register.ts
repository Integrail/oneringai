/**
 * GitHub Tools Registration
 *
 * Registers GitHub-specific tool factory with ConnectorTools.
 * When a connector with serviceType 'github' (or baseURL matching api.github.com)
 * is used, these tools become available automatically.
 */

import { ConnectorTools } from '../connector/ConnectorTools.js';
import type { Connector } from '../../core/Connector.js';
import { createSearchFilesTool } from './searchFiles.js';
import { createSearchCodeTool } from './searchCode.js';
import { createGitHubReadFileTool } from './readFile.js';
import { createGetPRTool } from './getPR.js';
import { createPRFilesTool } from './prFiles.js';
import { createPRCommentsTool } from './prComments.js';
import { createCreatePRTool } from './createPR.js';

/**
 * Register GitHub tools with the ConnectorTools framework.
 *
 * After calling this, `ConnectorTools.for('my-github-connector')` will
 * return all 7 GitHub tools plus the generic API tool.
 */
export function registerGitHubTools(): void {
  ConnectorTools.registerService('github', (connector: Connector, userId?: string) => {
    return [
      createSearchFilesTool(connector, userId),
      createSearchCodeTool(connector, userId),
      createGitHubReadFileTool(connector, userId),
      createGetPRTool(connector, userId),
      createPRFilesTool(connector, userId),
      createPRCommentsTool(connector, userId),
      createCreatePRTool(connector, userId),
    ];
  });
}
