/**
 * Content types based on OpenAI Responses API format
 */

export enum ContentType {
  INPUT_TEXT = 'input_text',
  INPUT_IMAGE_URL = 'input_image_url',
  INPUT_FILE = 'input_file',
  OUTPUT_TEXT = 'output_text',
  TOOL_USE = 'tool_use',
  TOOL_RESULT = 'tool_result',
}

export interface BaseContent {
  type: ContentType;
}

export interface InputTextContent extends BaseContent {
  type: ContentType.INPUT_TEXT;
  text: string;
}

export interface InputImageContent extends BaseContent {
  type: ContentType.INPUT_IMAGE_URL;
  image_url: {
    url: string; // HTTP URL or data URI
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface InputFileContent extends BaseContent {
  type: ContentType.INPUT_FILE;
  file_id: string;
}

export interface OutputTextContent extends BaseContent {
  type: ContentType.OUTPUT_TEXT;
  text: string;
  annotations?: any[];
}

export interface ToolUseContent extends BaseContent {
  type: ContentType.TOOL_USE;
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ToolResultContent extends BaseContent {
  type: ContentType.TOOL_RESULT;
  tool_use_id: string;
  content: string | any;
  error?: string;
}

export type Content =
  | InputTextContent
  | InputImageContent
  | InputFileContent
  | OutputTextContent
  | ToolUseContent
  | ToolResultContent;
