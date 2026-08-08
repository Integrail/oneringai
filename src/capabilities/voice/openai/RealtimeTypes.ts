/** OpenAI Realtime GA session and transport types. */

export type OpenAIRealtimeModel =
  | 'gpt-realtime-2.1'
  | 'gpt-realtime-2.1-mini'
  | 'gpt-realtime-2'
  | 'gpt-realtime-translate'
  | 'gpt-realtime-1.5'
  | 'gpt-realtime'
  | 'gpt-realtime-mini'
  | (string & {});

export type OpenAIRealtimeVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'marin'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'cedar'
  | (string & {});

export type OpenAIRealtimeAudioFormat =
  | { type: 'audio/pcm'; rate: 24000 }
  | { type: 'audio/pcmu' }
  | { type: 'audio/pcma' };

export interface OpenAIServerVAD {
  type: 'server_vad';
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  idle_timeout_ms?: number;
  create_response?: boolean;
  interrupt_response?: boolean;
}

export interface OpenAISemanticVAD {
  type: 'semantic_vad';
  eagerness?: 'low' | 'medium' | 'high' | 'auto';
  create_response?: boolean;
  interrupt_response?: boolean;
}

export type OpenAIRealtimeTurnDetection = OpenAIServerVAD | OpenAISemanticVAD | null;

export interface OpenAIRealtimeFunctionTool {
  type: 'function';
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface OpenAIRealtimeMCPTool {
  type: 'mcp';
  server_label: string;
  server_url?: string;
  connector_id?: string;
  authorization?: string;
  allowed_tools?: string[] | { read_only?: boolean; tool_names?: string[] } | null;
  require_approval?: 'always' | 'never' | {
    always?: { read_only?: boolean; tool_names?: string[] };
    never?: { read_only?: boolean; tool_names?: string[] };
  } | null;
  defer_loading?: boolean;
  headers?: Record<string, string> | null;
  server_description?: string;
}

export type OpenAIRealtimeTool = OpenAIRealtimeFunctionTool | OpenAIRealtimeMCPTool;

export interface OpenAIRealtimeTracing {
  workflow_name?: string;
  group_id?: string;
  metadata?: Record<string, string>;
}

export interface OpenAIRealtimeTruncation {
  type: 'retention_ratio';
  retention_ratio: number;
  token_limits?: { post_instructions?: number };
}

export interface OpenAIRealtimeSessionConfig {
  type?: 'realtime';
  model?: OpenAIRealtimeModel;
  instructions?: string;
  output_modalities?: Array<'audio' | 'text'>;
  max_output_tokens?: number | 'inf';
  parallel_tool_calls?: boolean;
  reasoning?: { effort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' };
  include?: Array<'item.input_audio_transcription.logprobs'>;
  prompt?: { id: string; version?: string; variables?: Record<string, string> } | null;
  tool_choice?: 'none' | 'auto' | 'required' | Record<string, unknown>;
  tools?: OpenAIRealtimeTool[];
  tracing?: 'auto' | OpenAIRealtimeTracing | null;
  truncation?: 'auto' | 'disabled' | OpenAIRealtimeTruncation;
  audio?: {
    input?: {
      format?: OpenAIRealtimeAudioFormat;
      noise_reduction?: { type: 'near_field' | 'far_field' } | null;
      transcription?: {
        model?: string;
        language?: string;
        prompt?: string;
      } | null;
      turn_detection?: OpenAIRealtimeTurnDetection;
    };
    output?: {
      format?: OpenAIRealtimeAudioFormat;
      voice?: OpenAIRealtimeVoice | { id: string };
      speed?: number;
    };
  };
}

export interface OpenAIRealtimeTranscriptionSessionConfig {
  type: 'transcription';
  audio?: {
    input?: {
      format?: OpenAIRealtimeAudioFormat;
      noise_reduction?: { type: 'near_field' | 'far_field' } | null;
      transcription?: {
        model?: 'gpt-live-transcribe' | 'gpt-transcribe' | (string & {});
        language?: string;
        languages?: string[];
        prompt?: string;
        keywords?: string[];
        delay?: 'low' | 'medium' | 'high' | (string & {});
      };
      turn_detection?: OpenAIRealtimeTurnDetection;
    };
  };
  include?: Array<'item.input_audio_transcription.logprobs'>;
}

export interface OpenAIRealtimeTranslationSessionConfig {
  audio: {
    output: {
      language: string;
    };
  };
}

/** Translation configuration accepted when minting a WebRTC client secret. */
export interface OpenAIRealtimeTranslationClientSessionConfig
  extends OpenAIRealtimeTranslationSessionConfig {
  model: 'gpt-realtime-translate' | (string & {});
}

export interface OpenAIRealtimeClientSecret {
  value: string;
  expires_at: number;
  session: OpenAIRealtimeSessionConfig
    | OpenAIRealtimeTranscriptionSessionConfig
    | OpenAIRealtimeTranslationClientSessionConfig;
}

export interface OpenAIRealtimeServerEvent {
  type: string;
  event_id?: string;
  // The server event union evolves frequently; callers narrow by `type`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface OpenAIRealtimeClientEvent {
  type: string;
  event_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
