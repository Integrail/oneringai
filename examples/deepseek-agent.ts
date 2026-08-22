/**
 * Dedicated DeepSeek adapter example.
 *
 * Required: DEEPSEEK_API_KEY. Set DEEPSEEK_HOST to a built-in host preset and
 * DEEPSEEK_BASE_URL for custom/Azure deployments.
 */
import 'dotenv/config';
import {
  Agent,
  Connector,
  DEEPSEEK_HOST_REGISTRY,
  type DeepSeekHost,
  Vendor,
} from '../src/index.js';

const host = (process.env.DEEPSEEK_HOST ?? 'official') as DeepSeekHost;
if (!(host in DEEPSEEK_HOST_REGISTRY)) {
  throw new Error(`Unknown DEEPSEEK_HOST: ${host}`);
}
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required');

Connector.create({
  name: 'deepseek-demo',
  vendor: Vendor.DeepSeek,
  auth: { type: 'api_key', apiKey },
  ...(process.env.DEEPSEEK_BASE_URL ? { baseURL: process.env.DEEPSEEK_BASE_URL } : {}),
  options: { deepseekHost: host },
});

const agent = Agent.create({
  connector: 'deepseek-demo',
  model: 'deepseek-v4-flash',
  thinking: { enabled: true, effort: 'high' },
});

try {
  const response = await agent.run('Give two practical advantages of connector-first architecture.', {
    responseFormat: {
      type: 'json_schema',
      name: 'advantages',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          advantages: { type: 'array', items: { type: 'string' } },
        },
        required: ['advantages'],
        additionalProperties: false,
      },
    },
  });
  console.log(response.output_parsed);
} finally {
  agent.destroy();
}
