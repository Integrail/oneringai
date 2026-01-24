/**
 * Example Custom Tool
 *
 * This demonstrates how to create a custom tool for AMOS.
 * Place .js or .mjs files in this directory and use /tool reload to load them.
 */

export default {
  definition: {
    type: 'function',
    function: {
      name: 'word_count',
      description: 'Count the number of words, characters, and sentences in text',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to analyze',
          },
        },
        required: ['text'],
      },
    },
  },

  /**
   * Execute the tool
   * @param {Object} args - The arguments
   * @param {string} args.text - The text to analyze
   * @returns {Promise<Object>} The analysis result
   */
  execute: async (args) => {
    const { text } = args;

    // Count words (split by whitespace)
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0);

    // Count sentences (split by sentence-ending punctuation)
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Count characters (excluding whitespace)
    const characters = text.replace(/\s/g, '').length;

    // Calculate average word length
    const avgWordLength =
      words.length > 0
        ? (words.reduce((sum, w) => sum + w.length, 0) / words.length).toFixed(1)
        : 0;

    return {
      wordCount: words.length,
      characterCount: characters,
      sentenceCount: sentences.length,
      averageWordLength: avgWordLength,
      text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    };
  },
};
