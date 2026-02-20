/**
 * Microsoft Graph - Send Email Tool
 *
 * Send an email or reply to an existing message.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction, ToolContext } from '../../domain/entities/Tool.js';
import {
  type MicrosoftSendEmailResult,
  getUserPathPrefix,
  microsoftFetch,
  formatRecipients,
} from './types.js';

export interface SendEmailArgs {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  replyToMessageId?: string;
  targetUser?: string;
}

/**
 * Create a Microsoft Graph send_email tool
 */
export function createSendEmailTool(
  connector: Connector,
  userId?: string
): ToolFunction<SendEmailArgs, MicrosoftSendEmailResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'send_email',
        description: `Send an email immediately or reply to an existing message via Microsoft Graph (Outlook). The email is sent right away — use create_draft_email to save a draft instead.

USAGE:
- New email: provide to, subject, and body (HTML content, e.g. "<p>Hello!</p>")
- Reply: also provide replyToMessageId (the Graph message ID of the original email) to send a threaded reply
- The body field accepts HTML — use <p>, <br>, <ul>, <b>, etc. for formatting

EXAMPLES:
- Send email: { "to": ["alice@contoso.com"], "subject": "Meeting tomorrow", "body": "<p>Hi Alice,</p><p>Can we meet at 2pm?</p>" }
- Reply: { "to": ["alice@contoso.com"], "subject": "Re: Meeting tomorrow", "body": "<p>Confirmed, see you then!</p>", "replyToMessageId": "AAMkADI1..." }
- With CC: { "to": ["alice@contoso.com"], "subject": "Update", "body": "<p>FYI</p>", "cc": ["bob@contoso.com"] }`,
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
              description: 'Microsoft Graph message ID of the email to reply to (e.g. "AAMkADI1..."). When set, sends a threaded reply instead of a new email.',
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

    describeCall: (args: SendEmailArgs): string => {
      const action = args.replyToMessageId ? 'Reply' : 'Send';
      return `${action} to ${args.to.join(', ')}: ${args.subject}`;
    },

    permission: {
      scope: 'session',
      riskLevel: 'medium',
      approvalMessage: `Send an email via ${connector.displayName}`,
    },

    execute: async (
      args: SendEmailArgs,
      context?: ToolContext
    ): Promise<MicrosoftSendEmailResult> => {
      const effectiveUserId = context?.userId ?? userId;
      try {
        const prefix = getUserPathPrefix(connector, args.targetUser);

        if (args.replyToMessageId) {
          // Reply to existing message
          await microsoftFetch(
            connector,
            `${prefix}/messages/${args.replyToMessageId}/reply`,
            {
              method: 'POST',
              userId: effectiveUserId,
              body: {
                message: {
                  toRecipients: formatRecipients(args.to),
                  ...(args.cc && { ccRecipients: formatRecipients(args.cc) }),
                },
                comment: args.body,
              },
            }
          );
        } else {
          // Send new email (returns 202 with empty body)
          await microsoftFetch(
            connector,
            `${prefix}/sendMail`,
            {
              method: 'POST',
              userId: effectiveUserId,
              body: {
                message: {
                  subject: args.subject,
                  body: { contentType: 'HTML', content: args.body },
                  toRecipients: formatRecipients(args.to),
                  ...(args.cc && { ccRecipients: formatRecipients(args.cc) }),
                },
                saveToSentItems: true,
              },
            }
          );
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
