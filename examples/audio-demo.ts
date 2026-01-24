/**
 * Audio capabilities demo - Text-to-Speech and Speech-to-Text
 *
 * This example demonstrates:
 * - Text-to-Speech synthesis with different voices and formats
 * - Speech-to-Text transcription with timestamps
 * - Model introspection and capability checking
 * - Voice assistant pipeline (STT → Agent → TTS)
 *
 * Requirements:
 * - OPENAI_API_KEY environment variable
 */

import { Connector, Agent, TextToSpeech, SpeechToText, Vendor, TTS_MODELS, STT_MODELS } from '../src/index.js';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Validate API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable required');
    console.error('   Get yours at: https://platform.openai.com/api-keys');
    process.exit(1);
  }

  // Create OpenAI connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
  });

  console.log('🎙️  Audio Capabilities Demo\n');

  // =============================================================================
  // Part 1: Text-to-Speech
  // =============================================================================

  console.log('📢 Part 1: Text-to-Speech (TTS)\n');

  const tts = TextToSpeech.create({
    connector: 'openai',
    model: TTS_MODELS[Vendor.OpenAI].TTS_1_HD,
    voice: 'nova', // Female voice
  });

  // Check capabilities
  console.log('Model Info:');
  const ttsInfo = tts.getModelInfo();
  console.log(`  - Model: ${ttsInfo.displayName}`);
  console.log(`  - Vendor: ${ttsInfo.provider}`);
  console.log(`  - Max Input: ${ttsInfo.capabilities.limits.maxInputLength} chars`);
  console.log(`  - Speed Control: ${tts.supportsSpeedControl()}`);
  console.log(`  - Instruction Steering: ${tts.supportsFeature('instructionSteering')}`);

  // List available voices
  const voices = await tts.listVoices();
  console.log(`\nAvailable Voices (${voices.length}):`);
  voices.slice(0, 5).forEach((v) => {
    console.log(`  - ${v.name} (${v.id}): ${v.gender}`);
  });

  // Synthesize speech
  console.log('\n🔊 Synthesizing speech...');
  const text = 'Hello! This is a demonstration of the OneRing AI text-to-speech capability.';
  const audio = await tts.synthesize(text);

  console.log(`✅ Generated ${audio.audio.length} bytes of ${audio.format} audio`);
  console.log(`   Characters used: ${audio.charactersUsed}`);
  console.log(`   Estimated cost: $${(audio.charactersUsed! / 1000) * 0.030}`);

  // Save to file
  const outputPath = './tts-output.mp3';
  await tts.toFile(text, outputPath);
  console.log(`   Saved to: ${outputPath}`);

  // Try different voice
  console.log('\n🎭 Trying different voice (echo - male)...');
  const echoAudio = await tts.synthesize(text, { voice: 'echo' });
  console.log(`✅ Generated ${echoAudio.audio.length} bytes with echo voice`);

  // Try speed control
  console.log('\n⚡ Trying speed control (2x faster)...');
  const fastAudio = await tts.synthesize(text, { speed: 2.0 });
  console.log(`✅ Generated ${fastAudio.audio.length} bytes at 2x speed`);
  console.log(`   (Notice smaller file size)`);

  // =============================================================================
  // Part 2: Speech-to-Text
  // =============================================================================

  console.log('\n\n🎤 Part 2: Speech-to-Text (STT)\n');

  const stt = SpeechToText.create({
    connector: 'openai',
    model: STT_MODELS[Vendor.OpenAI].WHISPER_1,
  });

  // Check capabilities
  const sttInfo = stt.getModelInfo();
  console.log('Model Info:');
  console.log(`  - Model: ${sttInfo.displayName}`);
  console.log(`  - Translation: ${stt.supportsTranslation()}`);
  console.log(`  - Diarization: ${stt.supportsDiarization()}`);
  console.log(`  - Timestamps: ${stt.supportsTimestamps()}`);
  console.log(`  - Max File Size: ${sttInfo.capabilities.limits.maxFileSizeMB}MB`);

  // Transcribe the audio we just created
  console.log('\n📝 Transcribing audio file...');
  const transcription = await stt.transcribeFile(outputPath);

  console.log('✅ Transcription result:');
  console.log(`   "${transcription.text}"`);
  console.log(`   Language: ${transcription.language}`);

  // Get detailed transcription with timestamps
  console.log('\n⏱️  Getting word-level timestamps...');
  const detailed = await stt.transcribeWithTimestamps(outputPath, 'word');

  console.log('✅ Word timestamps:');
  if (detailed.words && detailed.words.length > 0) {
    detailed.words.slice(0, 5).forEach((w) => {
      console.log(`   [${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s] "${w.word}"`);
    });
    console.log(`   ... (${detailed.words.length} words total)`);
  }

  // =============================================================================
  // Part 3: Voice Assistant Pipeline
  // =============================================================================

  console.log('\n\n🤖 Part 3: Voice Assistant Pipeline (STT → Agent → TTS)\n');

  // Create a simple agent
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4o-mini',
    instructions: 'You are a friendly assistant. Keep responses brief (1-2 sentences).',
  });

  // Simulate voice input
  console.log('🎙️  User says (via audio): "What is the capital of France?"');
  const userQuestion = 'What is the capital of France?';

  // Step 1: TTS to create "user audio"
  await tts.toFile(userQuestion, './user-input.mp3', { voice: 'onyx' });
  console.log('   Audio created: user-input.mp3');

  // Step 2: STT to transcribe
  const userTranscript = await stt.transcribeFile('./user-input.mp3');
  console.log(`\n📝 Transcribed: "${userTranscript.text}"`);

  // Step 3: Agent processes
  console.log('\n🤔 Agent thinking...');
  const agentResponse = await agent.run(userTranscript.text);
  console.log(`\n💬 Agent says: "${agentResponse.output_text}"`);

  // Step 4: TTS for agent response
  console.log('\n🔊 Converting to speech...');
  await tts.toFile(agentResponse.output_text, './agent-response.mp3', { voice: 'nova' });
  console.log('✅ Agent audio created: agent-response.mp3');

  console.log('\n✨ Voice assistant pipeline complete!');
  console.log('\n📁 Generated files:');
  console.log('   - tts-output.mp3 (initial demo)');
  console.log('   - user-input.mp3 (user question)');
  console.log('   - agent-response.mp3 (agent answer)');

  // =============================================================================
  // Part 4: Cost Estimation
  // =============================================================================

  console.log('\n\n💰 Part 4: Cost Estimation\n');

  const longText = 'A'.repeat(5000); // 5000 characters
  console.log(`Estimating cost for ${longText.length} characters with tts-1-hd:`);

  const tts1Info = tts.getModelInfo('tts-1');
  const tts1hdInfo = tts.getModelInfo('tts-1-hd');

  const cost1 = (longText.length / 1000) * tts1Info.pricing!.per1kCharacters;
  const costHD = (longText.length / 1000) * tts1hdInfo.pricing!.per1kCharacters;

  console.log(`  - tts-1:    $${cost1.toFixed(4)}`);
  console.log(`  - tts-1-hd: $${costHD.toFixed(4)}`);

  console.log('\n✅ Demo complete!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
