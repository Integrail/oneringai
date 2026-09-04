# Model Registry and Provider API Audit — 2026-09-04

**Status:** current registry audit

This audit covers every vendor represented in OneRingAI's model registries:
OpenAI, Anthropic, Google, xAI, DeepSeek, Groq, Mistral, and Ollama. It includes
text, realtime voice, TTS/STT, image, video, and embeddings. Official vendor
documentation was treated as the source of truth; floating aliases and preview
lifecycle notices were checked against release notes as well as model pages.

## 2026-09-04 OpenAI update

- Added GPT-6 Astra as the current limited-rollout flagship with Responses,
  Chat Completions, and Batch support; `low` through `max` reasoning; text and
  image input; a 1,050,000-token total context window, 922,000 maximum input,
  and 128,000 maximum output. The registry's `features.input.tokens` therefore
  records 922,000.
- Recorded standard, cached-input, cache-write, output, long-context, Batch,
  Flex, and Fast pricing from the official model page.
- Enabled Astra in OneRingAI runtime reasoning controls, OpenAI hosted-tool
  discovery, and GPT-5.6-or-later explicit prompt-cache handling.
- Added end-to-end Responses support for async function/custom tools,
  `configuration_update`, explicit `compaction_trigger`, and WebSocket
  `response.steer`, backed by OpenAI SDK 7.10 types.
- Added dedicated misalignment-policy error mapping and connector-first safety
  alert retrieval. Explicit Astra Fast/priority requests are rejected against
  the EU data-residency endpoint.

## 2026-08-30 refresh

The complete first-party pass found and corrected these changes since the
previous audit:

- OpenAI: current promotional GPT-5.6 Sol pricing; retired GPT-5/5.1/5.2/5.3
  aliases; upcoming GPT-4.1 Nano, audio, realtime, and GPT Image shutdowns;
  Sora 2 and Sora 2 Pro remain callable but are deprecated with the Videos API
  until 2026-09-24.
- Anthropic: Claude 5 remains the current documented family; no new registry
  model was required, and the retired Opus 4.1 migration remains Opus 5.
- Google: added Gemini 3.7 Flash, Gemini Omni 1.1 Flash, Gemini 3.5 Transcribe,
  and Gemini 3.5 Transcribe Live; retired Imagen 4; marked Gemini Omni Preview,
  Gemini 3.1 Flash-Lite, and Gemini 2.5 Flash Image with current lifecycle data.
- xAI: added Grok 4.6 and Grok Imagine Image 2.0, and updated Grok Imagine
  Video 1.5 for text-to-video support.
- DeepSeek: added V4 Flash Vision Experimental, current peak/off-peak pricing,
  and Responses routing for all current first-party V4 models.
- Groq, Mistral, and Ollama: added Whisper Large v3 Turbo, Codestral Embed,
  EmbeddingGemma, and All MiniLM; retired Distil Whisper and corrected current
  Whisper pricing and file/timestamp limits.

## Gaps found before implementation

| Area | Previous state | Gap |
|---|---|---|
| Registry contract | `isActive` plus modality-specific ad hoc fields | Could not distinguish preview, callable deprecation, retirement, aliases, snapshots, access scope, endpoints, or replacement models |
| Registry lookup | Canonical keys only | Floating API aliases such as `gpt-5.6` and `grok-voice-latest` failed lookup and constant-completeness checks |
| Pricing | Mostly one input/output token rate or flat media price | No long-context tiers, processing modes, cached writes, per-message voice charges, streaming STT, resolution, duration, or multimodal embedding/image token accounting |
| OpenAI | Older GPT/image/transcription/Sora entries and incomplete GA Realtime surface | Missing GPT-5.6 family, GPT-5.5 Pro, GPT Image 2, current transcription models, current Sora lifecycle/pricing, prompt-cache/service-tier options, and full Realtime client/API support |
| Anthropic | Registry stopped before the current Claude 5 family | Missing Opus 5/Mythos 5/Fable 5 metadata, current 1M/128K limits, adaptive effort, and fast mode |
| Google | `generateContent` only; older Gemini/media/embedding records | Missing Gemini 3.6/3.5 families, GA Interactions `steps` API, native 3.1 image models, current Veo/Omni/TTS, and multimodal Gemini Embedding 2 |
| xAI | Text plus older Grok image/video adapters | Missing Grok 4.5/4.3/Build, current image/video pricing and request restrictions, dedicated TTS/STT, streaming audio, and Voice Agent Realtime/SIP credential helpers |
| DeepSeek | Routed through the generic OpenAI Responses adapter with no registry entries | Chat-only models could be sent to an unsupported endpoint; full Responses reasoning was discarded; tool turns did not replay reasoning; current V4 models, hosted endpoints, FIM/balance, and real limits were absent |
| Tests/docs | Exact counts and retired preview ids were embedded in tests and guides | Tests rewarded stale facts; README/User Guide described superseded model families and only OpenAI/Groq audio |

## Implemented status

The public registry schema is now `MODEL_REGISTRY_SCHEMA_VERSION === 2`.
The change is additive except that unknown token windows are represented as
`null` instead of a synthetic zero. Existing canonical direct indexing still
works. Alias resolution is intentionally available through `getModelInfo()` and
the media equivalents rather than by duplicating records.

Schema v2 adds lifecycle, availability, aliases, snapshots, normalized
endpoints, deprecation/retirement dates, replacements, preferred choices,
official sources, vendor-option schemas, and expanded pricing. All modality
helpers now expose `getDeprecated*Models()` for callable models with a migration
notice.

Provider implementation now covers:

- OpenAI Responses options for current reasoning, service tiers, cache options,
  GPT-6 Astra and GPT-5.6 long-context accounting, GPT Image 2, current
  transcription, Sora 2,
  GA Realtime WebSocket/WebRTC credentials, transcription/translation, SIP
  controls, tools, VAD, and telephony bridging.
- Anthropic adaptive thinking and effort, current structured output, service
  tier/fast mode, and current model capability limits.
- Google Gemini 3.5+ through Interactions by default, including `steps`,
  `step.delta`, terminal status/error normalization, reasoning, tools, structured responses, and a documented
  `generateContent` opt-out; current image, video, TTS/STT, and multimodal
  embedding providers are registered and wired. Named tools remain forced on
  both Interactions and `generateContent`; external embedding media is
  timeout- and size-bounded to Google's 100 MB inline/50 MB PDF limits with
  content-based MIME inference.
- xAI native image/video, REST and WebSocket TTS, REST and WebSocket STT, and
  OpenAI-compatible realtime voice. Realtime supports ephemeral browser
  credentials, SIP refer/hangup, resumption ids, reasoning selection, and JSON
  or binary audio transport through `GrokRealtimeSession`, including every
  documented 8–48 kHz PCM rate without weakening OpenAI's 24 kHz session type.
  Buffered TTS format metadata follows xAI's response content type when a
  provider-specific `output_format` overrides the normalized default.
- DeepSeek now has a dedicated Chat Completions and Responses adapter. It
  auto-routes first-party V4 Flash/Pro, preserves full reasoning through tool
  loops, supports streaming, structured output, native web search, model
  listing, FIM, balance, and strict beta tools, and reports cache/reasoning
  usage. Host presets cover OpenRouter, Together, Fireworks, DeepInfra, NVIDIA
  NIM, and Azure Foundry while keeping host limits separate from canonical
  first-party metadata. The false first-party embeddings capability was removed.

The library now requires Node.js 22 or newer. This matches the upgraded current
OpenAI, Anthropic, and Google SDK baseline and is a deliberate package-level API
compatibility change.

## Current registry snapshot

The text/realtime registry contains 96 records: OpenAI 49, Anthropic 15,
Google 15, xAI 12, and DeepSeek 5. Dedicated registries contain 20 image, 10
video, 7 TTS, 14 STT, and 15 embedding records.

Notable preferred/current families are:

- OpenAI: GPT-6 Astra, GPT-5.6 Sol/Terra/Luna, GPT-5.5 Pro, GPT Image 2,
  GPT Realtime 2.1, and GPT Transcribe/Live Transcribe. Sora 2/2 Pro remain
  callable but have published deprecation and retirement metadata.
- Anthropic: Claude Opus 5, Mythos 5, Fable 5, Opus 4.8, and Sonnet 5.
- Google: Gemini 3.7 Flash, Gemini 3.5/3.6 families, Gemini 3.1 native
  image/TTS, Gemini Omni 1.1, Veo, Gemini 3.5 Transcribe, and Gemini Embedding 2.
- xAI: Grok 4.6, Grok 4.5/4.3, Grok Build 0.1, Grok Imagine Image 2.0,
  Grok Imagine Video 1.5, xAI TTS/STT, and Grok Voice Think Fast 2.0.
- DeepSeek: V4 Flash, V4 Pro, and V4 Flash Vision Experimental, plus retired records for
  `deepseek-chat` and `deepseek-reasoner` with migration targets.

## API migration notes

1. Use lookup helpers for aliases. `MODEL_REGISTRY['gpt-5.6']` remains
   undefined, while `getModelInfo('gpt-5.6')` resolves to `gpt-5.6-sol`.
2. Treat `isActive` as callable availability and `lifecycle` as migration
   state. A deprecated model can remain active until its retirement date.
3. Handle `features.input.tokens` and `features.output.tokens` as
   `number | null`; use `resolveMaxContextTokens()` when a numeric fallback is
   required.
4. Gemini 3.5+ automatically uses Interactions. Set
   `vendorOptions.api = 'generateContent'` for temporary wire compatibility.
5. Media cost helpers accept richer usage objects while retaining their old
   positional calls.
6. xAI streaming STT is exposed through
   `SpeechToText.transcribeStream()`/`IStreamingSpeechToTextProvider`; realtime
   speech-to-speech uses `OpenAIRealtimeSession` with a Grok connector.

## Supported boundaries

The inference library does not capture microphones, play speakers, construct a
browser `RTCPeerConnection`, provision carrier phone numbers, receive/verify
telephony webhooks, or create vendor dashboard resources. It supplies the model
wire protocols, credentials, media transforms, provider calls, and call-control
operations needed by a host application. These are host integration boundaries,
not missing model support.

## Validation completed

- 6,555 unit tests across 301 files, including registry contracts, provider
  routing, media defaults, Agent Runtime model overrides, and generated tool
  fingerprint verification.
- Strict TypeScript, ESLint, example compilation, ESM/CJS/declaration build,
  package-export verification, and public/internal API reference generation.
- AMOS and Convert builds passed. Hosea's build could not start because its
  standalone dependencies are not installed in this checkout
  (`@vitejs/plugin-react` is declared but absent).
- Authenticated vendor integration calls remain credential- and
  network-gated and were not counted as completed by this refresh.

## Official sources

- OpenAI: [models](https://developers.openai.com/api/docs/models),
  [pricing](https://developers.openai.com/api/docs/pricing),
  [Realtime](https://developers.openai.com/api/docs/guides/realtime),
  [image generation](https://developers.openai.com/api/docs/guides/image-generation),
  and [video generation](https://developers.openai.com/api/docs/guides/video-generation).
- Anthropic: [model overview](https://platform.claude.com/docs/en/about-claude/models/overview),
  [pricing](https://platform.claude.com/docs/en/about-claude/pricing),
  [effort](https://platform.claude.com/docs/en/build-with-claude/effort), and
  [fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode).
- Google: [models](https://ai.google.dev/gemini-api/docs/models),
  [pricing](https://ai.google.dev/gemini-api/docs/pricing),
  [release notes](https://ai.google.dev/gemini-api/docs/changelog),
  [Interactions](https://ai.google.dev/gemini-api/docs/interactions),
  [image generation](https://ai.google.dev/gemini-api/docs/image-generation),
  [video generation](https://ai.google.dev/gemini-api/docs/video), and
  [embeddings](https://ai.google.dev/gemini-api/docs/embeddings).
- xAI: [models](https://docs.x.ai/developers/models),
  [pricing](https://docs.x.ai/developers/pricing),
  [release notes](https://docs.x.ai/developers/release-notes),
  [Voice Agent API](https://docs.x.ai/developers/model-capabilities/audio/voice-agent),
  [TTS](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech),
  and [STT](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text).
- DeepSeek: [models and pricing](https://api-docs.deepseek.com/quick_start/pricing/),
  [Responses API](https://api-docs.deepseek.com/guides/responses_api/),
  [thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/),
  [context caching](https://api-docs.deepseek.com/guides/kv_cache/), and
  [release updates](https://api-docs.deepseek.com/updates/).
