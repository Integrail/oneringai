/**
 * Audio codec utilities for Twilio integration
 *
 * Twilio Media Streams send/receive μ-law encoded audio at 8kHz mono.
 * OpenAI TTS outputs PCM 16-bit signed LE at 24kHz.
 *
 * μ-law encoder and decoder are line-by-line translations of the
 * Sun Microsystems / ITU-T G.711 reference C implementation.
 * Source: CCITT Rec. G.711 (1988), also used in FFmpeg, sox, libsndfile.
 */

// =============================================================================
// μ-law encoder — Sun reference linear2ulaw()
// =============================================================================

/**
 * Segment lookup table for μ-law encoding.
 * Exact copy of Sun's exp_lut[256].
 */
const EXP_LUT = new Uint8Array([
  0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
]);

const BIAS = 0x84; // 132
const CLIP = 32635;

/**
 * Encode one 16-bit signed PCM sample to μ-law.
 * Exact translation of Sun's linear2ulaw().
 */
function linear2ulaw(sample: number): number {
  // Get the sign and the magnitude of the value.
  const sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;

  // Convert from 16-bit linear to ulaw.
  sample = sample + BIAS;
  const exponent = EXP_LUT[(sample >> 7) & 0xff]!;
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const ulawbyte = ~(sign | (exponent << 4) | mantissa) & 0xff;

  return ulawbyte;
}

// =============================================================================
// μ-law decoder — Sun reference ulaw2linear()
// =============================================================================

/**
 * Decode one μ-law byte to 16-bit signed PCM.
 * Exact translation of Sun's ulaw2linear().
 */
function ulaw2linear(ulawbyte: number): number {
  ulawbyte = ~ulawbyte & 0xff;
  const sign = ulawbyte & 0x80;
  const exponent = (ulawbyte >> 4) & 0x07;
  const mantissa = ulawbyte & 0x0f;

  let t = ((mantissa << 3) + BIAS) << exponent;

  return sign !== 0 ? (BIAS - t) : (t - BIAS);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Decode μ-law audio buffer to PCM 16-bit signed little-endian.
 *
 * @param mulaw - Buffer of μ-law encoded bytes (8kHz mono)
 * @returns Buffer of PCM 16-bit signed LE samples (2x the input length)
 */
export function mulawToPcm(mulaw: Buffer): Buffer {
  const pcm = Buffer.allocUnsafe(mulaw.length * 2);

  for (let i = 0; i < mulaw.length; i++) {
    pcm.writeInt16LE(ulaw2linear(mulaw[i]!), i * 2);
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
  const safeLen = pcm.length & ~1;
  const samples = safeLen / 2;
  const mulaw = Buffer.allocUnsafe(samples);

  for (let i = 0; i < samples; i++) {
    mulaw[i] = linear2ulaw(pcm.readInt16LE(i * 2));
  }

  return mulaw;
}

/**
 * Resample PCM 16-bit audio.
 * Downsampling uses box filter (averaging) for anti-aliasing.
 * Upsampling uses linear interpolation.
 *
 * @param pcm - Input PCM 16-bit signed LE buffer
 * @param fromRate - Source sample rate (e.g., 24000)
 * @param toRate - Target sample rate (e.g., 8000)
 * @returns Resampled PCM 16-bit signed LE buffer
 */
export function resamplePcm(pcm: Buffer, fromRate: number, toRate: number): Buffer {
  if (fromRate === toRate) return pcm;

  // Ensure even byte count (PCM s16le = 2 bytes per sample)
  const safeLength = pcm.length & ~1;
  if (safeLength < 2) return Buffer.alloc(0);

  const inputSamples = safeLength / 2;
  const ratio = fromRate / toRate;
  const outputSamples = Math.ceil(inputSamples / ratio);
  const output = Buffer.allocUnsafe(outputSamples * 2);

  if (ratio > 1) {
    // Downsampling: average source samples in each window (anti-aliasing box filter).
    for (let i = 0; i < outputSamples; i++) {
      const srcStart = i * ratio;
      const srcEnd = Math.min((i + 1) * ratio, inputSamples);
      const jStart = Math.floor(srcStart);
      const jEnd = Math.min(Math.ceil(srcEnd), inputSamples);

      let sum = 0;
      let count = 0;
      for (let j = jStart; j < jEnd; j++) {
        sum += pcm.readInt16LE(j * 2);
        count++;
      }

      const sample = count > 0 ? Math.round(sum / count) : 0;
      output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
    }
  } else {
    // Upsampling: linear interpolation
    for (let i = 0; i < outputSamples; i++) {
      const srcIdx = i * ratio;
      const srcFloor = Math.floor(srcIdx);
      const srcCeil = Math.min(srcFloor + 1, inputSamples - 1);
      const frac = srcIdx - srcFloor;

      const s1 = pcm.readInt16LE(srcFloor * 2);
      const s2 = pcm.readInt16LE(srcCeil * 2);

      const sample = Math.round(s1 + (s2 - s1) * frac);
      output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
    }
  }

  return output;
}

/**
 * Convert Twilio μ-law 8kHz audio to PCM 16-bit at target sample rate.
 */
export function twilioToStt(mulaw: Buffer, targetRate: number = 16000): Buffer {
  const pcm8k = mulawToPcm(mulaw);
  return resamplePcm(pcm8k, 8000, targetRate);
}

/**
 * Convert PCM 16-bit audio to Twilio μ-law 8kHz format.
 */
export function sttToTwilio(pcm: Buffer, sourceRate: number = 24000): Buffer {
  const pcm8k = resamplePcm(pcm, sourceRate, 8000);
  return pcmToMulaw(pcm8k);
}
