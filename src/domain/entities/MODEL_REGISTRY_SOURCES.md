# Model Registry Sources

Reference document for updating ALL model registries: LLM (`Model.ts`), Image (`ImageModel.ts`), Video (`VideoModel.ts`), TTS (`TTSModel.ts`), STT (`STTModel.ts`).

---

## OpenAI

### LLM Models (`Model.ts`)
- **Models page**: https://platform.openai.com/docs/models
- **Pricing page**: https://openai.com/api/pricing/
- **API reference**: https://platform.openai.com/docs/api-reference
- **Key fields**: context window, max output tokens, pricing (input/cached/output), knowledge cutoff, supported features (vision, audio, reasoning, structured output, function calling)
- **Notes**: Cached input pricing is 10x cheaper than standard input. Reasoning models (o-series, GPT-5.x) don't support temperature/topP. Chat-latest variants have smaller context (128K) and no reasoning.

### Image Models (`ImageModel.ts`)
- **Image guide**: https://platform.openai.com/docs/guides/images
- **Models**: `gpt-image-1`, `dall-e-3`, `dall-e-2`
- **Key fields**: sizes, max images per request, quality levels, output formats, editing/variation support

### Video Models (`VideoModel.ts`)
- **Video guide**: https://platform.openai.com/docs/guides/video-generation
- **API reference**: https://platform.openai.com/docs/api-reference/videos
- **Models**: `sora-2`, `sora-2-pro`
- **Key fields**: durations, resolutions, fps, audio support, per-second pricing

### TTS Models (`TTSModel.ts`)
- **TTS guide**: https://platform.openai.com/docs/guides/text-to-speech
- **Models**: `gpt-4o-mini-tts` (instruction-steerable), `tts-1`, `tts-1-hd`
- **Key fields**: voices, formats, max input length, per-1k-character pricing

### STT Models (`STTModel.ts`)
- **STT guide**: https://platform.openai.com/docs/guides/speech-to-text
- **Models**: `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize`, `whisper-1`
- **Key fields**: input formats, output formats, max file size, per-minute pricing

---

## Anthropic

### LLM Models (`Model.ts`)
- **Models overview**: https://platform.claude.com/docs/en/about-claude/models/overview
- **Pricing page**: https://www.anthropic.com/pricing
- **Key fields**: context window (200K standard, 1M beta for some), max output, pricing (input/cached/output), extended thinking support
- **Notes**: All Claude 4+ models support extended thinking. Cached pricing is 10x cheaper. Prompt caching via cache_control blocks.

---

## Google (Gemini)

### Main Pages
- **Models overview (START HERE)**: https://ai.google.dev/gemini-api/docs/models
- **Pricing page**: https://ai.google.dev/pricing

### LLM Model Detail Pages
- **Gemini 3.1 Pro Preview**: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview
- **Gemini 3 Flash**: https://ai.google.dev/gemini-api/docs/models/gemini-3-flash
- **Gemini 3 Pro Preview** (DEPRECATED): https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-preview
- **Gemini 2.5 Pro**: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro
- **Gemini 2.5 Flash**: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
- **Gemini 2.5 Flash Lite**: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite
- **Key fields per page**: model ID, input/output token limits, supported modalities (text/image/audio/video), features (function calling, structured output, thinking, caching, batch API, search grounding, code execution, Live API), knowledge cutoff, latest update date

### Image Models (`ImageModel.ts`)
- **Imagen 4 guide**: https://ai.google.dev/gemini-api/docs/imagen
- **Nano Banana (Gemini 2.5 Flash Image)**: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image
- **Nano Banana Pro (Gemini 3 Pro Image)**: https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview
- **Nano Banana 2 (Gemini 3.1 Flash Image)**: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview
- **Models**: Imagen 4 (`imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001`), Nano Banana series (`gemini-2.5-flash-image`, `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`)
- **Key fields**: aspect ratios, resolution tiers (0.5K/1K/2K/4K), max prompt tokens, per-image pricing (varies by resolution for Nano Banana), editing support
- **Notes**: Imagen 4 supports English-only prompts, max 480 token prompt. Nano Banana models are Gemini-based with larger context windows (65K-131K). Nano Banana 2 supports up to 4K resolution. Nano Banana Pro has reasoning/thinking capabilities.

### Video Models (`VideoModel.ts`)
- **Video guide**: https://ai.google.dev/gemini-api/docs/video
- **Models**: `veo-2.0-generate-001`, `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview`
- **Key fields**: durations (4/6/8s), resolutions (720p/1080p/4K), aspect ratios, audio support, per-second pricing
- **Notes**: Veo 2 only supports 720p, no audio, no reference images. Veo 3.1 supports native audio, reference images (up to 3), video extension. 1080p/4K require 8s duration. Pricing varies by resolution tier (720p/1080p vs 4K).

### TTS Models (`TTSModel.ts`)
- **Speech generation guide**: https://ai.google.dev/gemini-api/docs/speech-generation
- **Flash TTS detail**: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-preview-tts
- **Models**: `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`
- **Key fields**: 30 prebuilt voices, 70+ languages, 32K token context window, PCM output (24kHz 16-bit mono), max 2 speakers per session
- **Pricing**: Token-based (not character-based like OpenAI). Flash: $0.50/$10 per 1M tokens in/out. Pro: $1/$20 per 1M tokens.

### Audio Models (not yet in registry)
- **Native Audio Preview**: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-native-audio-preview
- **Model**: `gemini-2.5-flash-native-audio-preview` — Live API model for bidirectional voice/video agents. 131K input, 8K output. Not a traditional TTS model.

### Music Models (not yet in registry)
- **Lyria**: https://ai.google.dev/gemini-api/docs/models/lyria-realtime-exp
- **Model**: `lyria-realtime-exp` — Experimental music generation. 48kHz stereo PCM output, text-prompt input. No dedicated registry exists for music models.

---

## xAI (Grok)

### LLM Models (`Model.ts`)
- **Models page**: https://docs.x.ai/developers/models
- **Key fields**: context window (up to 2M), max output, pricing (input/cached/output), vision support, reasoning
- **Notes**: Fast variants available for most models. Grok Code specialized for coding. All models support prompt caching and batch API.

### Image Models (`ImageModel.ts`)
- **Image generation guide**: https://docs.x.ai/docs/guides/image-generation
- **Models**: `grok-imagine-image` (with editing), `grok-2-image-1212` (text-only, no editing)
- **Key fields**: aspect ratios (14+ options including 1:2, 2:1, 19.5:9, etc.), resolutions (1K/2K), max 10 images per request, flat per-image pricing
- **Notes**: `grok-imagine-image` supports multi-turn editing and style transfer. Generated URLs are temporary.

### Video Models (`VideoModel.ts`)
- **Video generation guide**: https://docs.x.ai/docs/guides/video-generations
- **Model**: `grok-imagine-video`
- **Key fields**: durations (1-15s), resolutions (480p/720p), aspect ratios, audio support, per-second pricing

---

## Groq

### STT Models (`STTModel.ts`)
- **Speech-to-text docs**: https://console.groq.com/docs/speech-text
- **Pricing**: https://groq.com/pricing/
- **Models**: `whisper-large-v3`, `distil-whisper-large-v3-en`
- **Key fields**: per-minute pricing, max file size, segment-level timestamps only
- **Notes**: 12x cheaper than OpenAI Whisper. distil variant is English-only.

---

## Update Checklist

When updating the registries:

1. **Start with the vendor's main models page** — check for new models, deprecations, status changes
2. **Follow detail links for each model** — get exact token limits, features, capabilities
3. **Check the pricing page** — verify all pricing (input/cached/output, per-image, per-second, etc.)
4. **Update constants** — `LLM_MODELS`, `IMAGE_MODELS`, `VIDEO_MODELS`, `TTS_MODELS`, `STT_MODELS`
5. **Update registry entries** — add new models, fix existing ones
6. **Update test files** — counts, assertions, cost calculations
7. **Run verification**:
   ```bash
   npm run typecheck
   npm run test:unit -- tests/unit/domain/entities/Model.test.ts
   npm run test:unit -- tests/unit/image/ImageModel.test.ts
   npm run test:unit -- tests/unit/video/VideoModel.test.ts
   npm run test:unit -- tests/unit/audio/TTSModel.test.ts
   ```
8. **Update CHANGELOG.md**
9. **Update `lastVerified` dates** on all touched registry entries
