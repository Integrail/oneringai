/**
 * Permission Utilities
 *
 * Shared utilities for building permission configurations.
 * Extracted to avoid duplication between create and resume paths.
 */

import type {
  AgentPermissionsConfig,
  PermissionCheckContext,
  ApprovalDecision,
} from '@oneringai/agents';
import type { AmosConfig, ToolApprovalContext } from '../config/types.js';

/**
 * Build AgentPermissionsConfig from AMOS config
 *
 * This utility extracts the permission config building logic that was
 * duplicated in AgentRunner's initialize() method (once for resume, once for create).
 *
 * @param config - AMOS application configuration
 * @param onApprovalRequired - Optional callback for interactive approval prompts
 * @returns AgentPermissionsConfig ready for UniversalAgent
 */
export function buildPermissionsConfig(
  config: AmosConfig,
  onApprovalRequired?: (context: ToolApprovalContext) => Promise<ApprovalDecision>
): AgentPermissionsConfig {
  const { permissions } = config;

  return {
    defaultScope: permissions.defaultScope,
    defaultRiskLevel: permissions.defaultRiskLevel,
    allowlist: permissions.allowlist,
    blocklist: permissions.blocklist,
    tools: permissions.toolOverrides,
    onApprovalRequired:
      permissions.promptForApproval && onApprovalRequired
        ? async (context: PermissionCheckContext): Promise<ApprovalDecision> => {
            return onApprovalRequired({
              toolName: context.toolCall.function.name,
              args: context.toolCall.function.arguments,
              riskLevel: context.config?.riskLevel,
              reason: context.config?.approvalMessage || 'Tool requires approval',
            });
          }
        : undefined,
  };
}
