/**
 * Microsoft Graph - Create Draft Email Tool
 *
 * Create a draft email or draft reply in the user's mailbox.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction, ToolContext } from '../../domain/entities/Tool.js';
import {
  type MicrosoftDraftEmailResult,
  type GraphMessageResponse,
  getUserPathPrefix,
  microsoftFetch,
  formatRecipients,
} from './types.js';

export interface CreateDraftEmailArgs {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  replyToMessageId?: string;
  targetUser?: string;
}

/**
 * Create a Microsoft Graph create_draft_email tool
 */
export function createDraftEmailTool(
  connector: Connector,
  userId?: string
): ToolFunction<CreateDraftEmailArgs, MicrosoftDraftEmailResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'create_draft_email',
        description: `Create a draft email or draft reply in the user's Outlook mailbox via Microsoft Graph. The draft is saved but NOT sent — use send_email to send immediately instead.

USAGE:
- New draft: provide to, subject, and body (HTML content, e.g. "<p>Hello!</p>")
- Reply draft: also provide replyToMessageId (the Graph message ID of the original email) to create a threaded reply draft
- The body field accepts HTML — use <p>, <br>, <ul>, <b>, etc. for formatting

EXAMPLES:
- New draft: { "to": ["alice@contoso.com"], "subject": "Project update", "body": "<p>Hi Alice,</p><p>Here is the update.</p>" }
- Reply draft: { "to": ["alice@contoso.com"], "subject": "Re: Project update", "body": "<p>Thanks for the info!</p>", "replyToMessageId": "AAMkADI1..." }
- With CC: { "to": ["alice@contoso.com"], "subject": "Meeting notes", "body": "<p>Notes attached.</p>", "cc": ["bob@contoso.com"] }`,
        parameters: {
          type: 'object',
          properties: {
            to: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recipient email addresses',
            },
            subject: {
              type: 'string',
              description: 'Email subject line (use "Re: ..." prefix for replies)',
            },
            body: {
              type: 'string',
              description: 'Email body as HTML content (e.g. "<p>Hello!</p>"). Use HTML tags for formatting.',
            },
            cc: {
              type: 'array',
              items: { type: 'string' },
              description: 'CC recipient email addresses (optional)',
            },
            replyToMessageId: {
              type: 'string',
              description: 'Microsoft Graph message ID of the email to reply to (e.g. "AAMkADI1..."). When set, creates a threaded reply draft instead of a new draft.',
            },
            targetUser: {
              type: 'string',
              description: 'User ID or email (UPN) to act on behalf of. Only needed for app-only (client_credentials) auth. Ignored in delegated auth.',
            },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    },

    describeCall: (args: CreateDraftEmailArgs): string => {
      const action = args.replyToMessageId ? 'Reply draft' : 'Draft';
      return `${action} to ${args.to.join(', ')}: ${args.subject}`;
    },

    permission: {
      scope: 'session',
      riskLevel: 'medium',
      approvalMessage: `Create a draft email via ${connector.displayName}`,
    },

    execute: async (
      args: CreateDraftEmailArgs,
      context?: ToolContext
    ): Promise<MicrosoftDraftEmailResult> => {
      const effectiveUserId = context?.userId ?? userId;
      try {
        const prefix = getUserPathPrefix(connector, args.targetUser);

        if (args.replyToMessageId) {
          // Reply draft: createReply → then PATCH to update body/recipients
          const replyDraft = await microsoftFetch<GraphMessageResponse>(
            connector,
            `${prefix}/messages/${args.replyToMessageId}/createReply`,
            { method: 'POST', userId: effectiveUserId, body: {} }
          );

          // Update the reply draft with our content
          const updated = await microsoftFetch<GraphMessageResponse>(
            connector,
            `${prefix}/messages/${replyDraft.id}`,
            {
              method: 'PATCH',
              userId: effectiveUserId,
              body: {
                subject: args.subject,
                body: { contentType: 'HTML', content: args.body },
                toRecipients: formatRecipients(args.to),
                ...(args.cc && { ccRecipients: formatRecipients(args.cc) }),
              },
            }
          );

          return {
            success: true,
            draftId: updated.id,
            webLink: updated.webLink,
          };
        }

        // New draft
        const draft = await microsoftFetch<GraphMessageResponse>(
          connector,
          `${prefix}/messages`,
          {
            method: 'POST',
            userId: effectiveUserId,
            body: {
              isDraft: true,
              subject: args.subject,
              body: { contentType: 'HTML', content: args.body },
              toRecipients: formatRecipients(args.to),
              ...(args.cc && { ccRecipients: formatRecipients(args.cc) }),
            },
          }
        );

        return {
          success: true,
          draftId: draft.id,
          webLink: draft.webLink,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create draft email: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
