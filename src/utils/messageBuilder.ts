/**
 * Message builder utilities for constructing complex inputs
 */

import { InputItem, MessageRole } from '../domain/entities/Message.js';
import {
  ContentType,
  InputTextContent,
  InputImageContent,
} from '../domain/entities/Content.js';

export class MessageBuilder {
  private messages: InputItem[] = [];

  /**
   * Add a user text message
   */
  addUserMessage(text: string): this {
    this.messages.push({
      type: 'message',
      role: MessageRole.USER,
      content: [
        {
          type: ContentType.INPUT_TEXT,
          text,
        },
      ],
    });
    return this;
  }

  /**
   * Add a user message with text and images
   */
  addUserMessageWithImages(text: string, imageUrls: string[]): this {
    const content: (InputTextContent | InputImageContent)[] = [
      {
        type: ContentType.INPUT_TEXT,
        text,
      },
    ];

    // Add images
    for (const url of imageUrls) {
      content.push({
        type: ContentType.INPUT_IMAGE_URL,
        image_url: {
          url,
          detail: 'auto', // Can be 'auto', 'low', or 'high'
        },
      });
    }

    this.messages.push({
      type: 'message',
      role: MessageRole.USER,
      content,
    });

    return this;
  }

  /**
   * Add an assistant message (for conversation history)
   */
  addAssistantMessage(text: string): this {
    this.messages.push({
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [
        {
          type: ContentType.OUTPUT_TEXT,
          text,
          annotations: [],
        },
      ],
    });
    return this;
  }

  /**
   * Add a system/developer message
   */
  addDeveloperMessage(text: string): this {
    this.messages.push({
      type: 'message',
      role: MessageRole.DEVELOPER,
      content: [
        {
          type: ContentType.INPUT_TEXT,
          text,
        },
      ],
    });
    return this;
  }

  /**
   * Build and return the messages array
   */
  build(): InputItem[] {
    return this.messages;
  }

  /**
   * Clear all messages
   */
  clear(): this {
    this.messages = [];
    return this;
  }

  /**
   * Get the current message count
   */
  count(): number {
    return this.messages.length;
  }
}

/**
 * Helper function to create a simple text message
 */
export function createTextMessage(text: string, role: MessageRole = MessageRole.USER): InputItem {
  return {
    type: 'message',
    role,
    content: [
      {
        type: ContentType.INPUT_TEXT,
        text,
      },
    ],
  };
}

/**
 * Helper function to create a message with images
 */
export function createMessageWithImages(
  text: string,
  imageUrls: string[],
  role: MessageRole = MessageRole.USER
): InputItem {
  const content: (InputTextContent | InputImageContent)[] = [
    {
      type: ContentType.INPUT_TEXT,
      text,
    },
  ];

  for (const url of imageUrls) {
    content.push({
      type: ContentType.INPUT_IMAGE_URL,
      image_url: {
        url,
        detail: 'auto',
      },
    });
  }

  return {
    type: 'message',
    role,
    content,
  };
}
