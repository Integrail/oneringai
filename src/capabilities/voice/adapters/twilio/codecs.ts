/**
 * Audio codec utilities for Twilio integration
 *
 * Twilio Media Streams send/receive μ-law encoded audio at 8kHz mono.
 * STT/TTS providers typically expect PCM 16-bit at 16kHz or 24kHz.
 *
 * This module provides:
 * - μ-law → PCM 16-bit conversion
 * - PCM 16-bit → μ-law conversion
 * - Sample rate conversion (simple linear interpolation)
 */

// =============================================================================
// μ-law lookup tables (ITU-T G.711)
// =============================================================================

/**
 * μ-law to 16-bit linear PCM decode table.
 * Pre-computed for all 256 possible μ-law byte values.
 */
const MULAW_TO_LINEAR = new Int16Array(256);

// Build decode table
(() => {
  const MULAW_BIAS = 33;

  for (let i = 0; i < 256; i++) {
    // Complement and extract sign, exponent, mantissa
    const mu = ~i & 0xff;
    const sign = (mu & 0x80) !== 0 ? -1 : 1;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;

    // Decode
    let magnitude = ((mantissa << 1) + MULAW_BIAS) << exponent;
    magnitude -= MULAW_BIAS;

    MULAW_TO_LINEAR[i] = sign * magnitude;
  }
})();

/**
 * Encode a 16-bit linear PCM sample to μ-law.
 */
function linearToMulaw(sample: number): number {
  const MULAW_BIAS = 33;
  const MULAW_CLIP = 32635;

  // Get sign
  const sign = sample < 0 ? 0x80 : 0;
  let magnitude = Math.abs(sample);

  // Clip
  if (magnitude > MULAW_CLIP) magnitude = MULAW_CLIP;

  // Add bias
  magnitude += MULAW_BIAS;

  // Find exponent and mantissa
  let exponent = 7;
  const exponentMask = 0x4000;
  for (let i = 0; i < 8; i++) {
    if (magnitude & (exponentMask >> i)) {
      exponent = 7 - i;
      break;
    }
  }

  // Use a simpler approach: find segment
  exponent = 0;
  let shifted = magnitude >> 1;
  while (shifted >= 0x40 && exponent < 7) {
    shifted >>= 1;
    exponent++;
  }

  const mantissa = (magnitude >> (exponent + 1)) & 0x0f;
  const mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;

  return mulawByte;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Decode μ-law audio buffer to PCM 16-bit signed little-endian.
 *
 * @param mulaw - Buffer of μ-law encoded bytes
 * @returns Buffer of PCM 16-bit signed LE samples (2x the input length)
 */
export function mulawToPcm(mulaw: Buffer): Buffer {
  const pcm = Buffer.allocUnsafe(mulaw.length * 2);

  for (let i = 0; i < mulaw.length; i++) {
    const sample = MULAW_TO_LINEAR[mulaw[i]!]!;
    pcm.writeInt16LE(sample, i * 2);
  }

  return pcm;
}

/**
 * Encode PCM 16-bit signed little-endian to μ-law.
 *
 * @param pcm - Buffer of PCM 16-bit signed LE samples
 * @returns Buffer of μ-law encoded bytes (half the input length)
 */
export function pcmToMulaw(pcm: Buffer): Buffer {
  const samples = pcm.length / 2;
  const mulaw = Buffer.allocUnsafe(samples);

  for (let i = 0; i < samples; i++) {
    const sample = pcm.readInt16LE(i * 2);
    mulaw[i] = linearToMulaw(sample);
  }

  return mulaw;
}

/**
 * Resample PCM 16-bit audio using linear interpolation.
 *
 * @param pcm - Input PCM 16-bit signed LE buffer
 * @param fromRate - Source sample rate (e.g., 8000)
 * @param toRate - Target sample rate (e.g., 16000)
 * @returns Resampled PCM 16-bit signed LE buffer
 */
export function resamplePcm(pcm: Buffer, fromRate: number, toRate: number): Buffer {
  if (fromRate === toRate) return pcm;

  const inputSamples = pcm.length / 2;
  const ratio = fromRate / toRate;
  const outputSamples = Math.ceil(inputSamples / ratio);
  const output = Buffer.allocUnsafe(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcIdx = i * ratio;
    const srcFloor = Math.floor(srcIdx);
    const srcCeil = Math.min(srcFloor + 1, inputSamples - 1);
    const frac = srcIdx - srcFloor;

    const s1 = pcm.readInt16LE(srcFloor * 2);
    const s2 = pcm.readInt16LE(srcCeil * 2);

    // Linear interpolation
    const sample = Math.round(s1 + (s2 - s1) * frac);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
  }

  return output;
}

/**
 * Convert Twilio μ-law 8kHz audio to PCM 16-bit at target sample rate.
 * This is the standard inbound conversion for STT processing.
 *
 * @param mulaw - μ-law encoded audio from Twilio (8kHz)
 * @param targetRate - Target sample rate (default: 16000 for most STT)
 * @returns PCM 16-bit signed LE buffer at target sample rate
 */
export function twilioToStt(mulaw: Buffer, targetRate: number = 16000): Buffer {
  const pcm8k = mulawToPcm(mulaw);
  return resamplePcm(pcm8k, 8000, targetRate);
}

/**
 * Convert PCM 16-bit audio to Twilio μ-law 8kHz format.
 * This is the standard outbound conversion for sending TTS to caller.
 *
 * @param pcm - PCM 16-bit signed LE buffer
 * @param sourceRate - Source sample rate (default: 24000 for OpenAI TTS PCM)
 * @returns μ-law encoded buffer at 8kHz for Twilio
 */
export function sttToTwilio(pcm: Buffer, sourceRate: number = 24000): Buffer {
  const pcm8k = resamplePcm(pcm, sourceRate, 8000);
  return pcmToMulaw(pcm8k);
}
