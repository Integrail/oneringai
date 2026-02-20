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

PARAMETER FORMATS:
- to/cc: plain string array of email addresses. Example: ["alice@contoso.com", "bob@contoso.com"]. Do NOT use objects.
- subject: plain string. Example: "Meeting tomorrow" or "Re: Meeting tomorrow" for replies.
- body: HTML string. Example: "<p>Hi Alice,</p><p>Can we meet at 2pm?</p>". Use <p>, <br>, <b>, <ul> tags.
- replyToMessageId: Graph message ID string (starts with "AAMk..."). Only set when replying to an existing email.

EXAMPLES:
- Send email: { "to": ["alice@contoso.com"], "subject": "Meeting tomorrow", "body": "<p>Can we meet at 2pm?</p>" }
- Reply: { "to": ["alice@contoso.com"], "subject": "Re: Meeting", "body": "<p>Confirmed!</p>", "replyToMessageId": "AAMkADI1..." }
- With CC: { "to": ["alice@contoso.com"], "subject": "Update", "body": "<p>FYI</p>", "cc": ["bob@contoso.com"] }`,
        parameters: {
          type: 'object',
          properties: {
            to: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recipient email addresses as plain strings. Example: ["alice@contoso.com", "bob@contoso.com"]',
            },
            subject: {
              type: 'string',
              description: 'Email subject as plain string. Example: "Meeting tomorrow" or "Re: Original subject" for replies.',
            },
            body: {
              type: 'string',
              description: 'Email body as an HTML string. Example: "<p>Hi!</p><p>Can we meet at 2pm?</p>"',
            },
            cc: {
              type: 'array',
              items: { type: 'string' },
              description: 'CC email addresses as plain strings. Example: ["bob@contoso.com"]. Optional.',
            },
            replyToMessageId: {
              type: 'string',
              description: 'Graph message ID of the email to reply to. Example: "AAMkADI1M2I3YzgtODg...". When set, sends a threaded reply.',
            },
            targetUser: {
              type: 'string',
              description: 'User ID or email (UPN) for app-only auth. Example: "alice@contoso.com". Ignored in delegated auth.',
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
