-- Initial service_overrides for LLM vendors and utility services
-- Configures metering paths and pricing multipliers

-- LLM Vendors (OpenAI-compatible response format)
INSERT OR IGNORE INTO service_overrides (service_id, display_name, is_enabled, platform_key_enabled, pricing_multiplier, metering_config) VALUES
('openai', 'OpenAI', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.prompt_tokens","outputTokensPath":"usage.completion_tokens","streamFinalChunk":true}'),
('anthropic', 'Anthropic', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.input_tokens","outputTokensPath":"usage.output_tokens","streamFinalEvent":"message_stop"}'),
('google', 'Google AI', 1, 0, 2.0, '{"usagePath":"usageMetadata","modelPath":"model","inputTokensPath":"usageMetadata.promptTokenCount","outputTokensPath":"usageMetadata.candidatesTokenCount"}'),
('grok', 'xAI Grok', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.prompt_tokens","outputTokensPath":"usage.completion_tokens","streamFinalChunk":true}'),
('groq', 'Groq', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.prompt_tokens","outputTokensPath":"usage.completion_tokens"}'),
('together', 'Together AI', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.prompt_tokens","outputTokensPath":"usage.completion_tokens"}'),
('deepseek', 'DeepSeek', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.prompt_tokens","outputTokensPath":"usage.completion_tokens"}'),
('mistral', 'Mistral', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.prompt_tokens","outputTokensPath":"usage.completion_tokens"}'),
('perplexity', 'Perplexity', 1, 0, 2.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"usage.prompt_tokens","outputTokensPath":"usage.completion_tokens"}'),
('ollama', 'Ollama', 1, 0, 1.0, '{"usagePath":"usage","modelPath":"model","inputTokensPath":"prompt_eval_count","outputTokensPath":"eval_count"}');

-- Search providers (flat cost per request)
INSERT OR IGNORE INTO service_overrides (service_id, display_name, is_enabled, platform_key_enabled, pricing_multiplier, metering_config) VALUES
('serper', 'Serper Search', 1, 0, 2.0, '{"flatCostPerRequest":10}'),
('brave-search', 'Brave Search', 1, 0, 2.0, '{"flatCostPerRequest":10}'),
('tavily', 'Tavily Search', 1, 0, 2.0, '{"flatCostPerRequest":10}');

-- Scraping
INSERT OR IGNORE INTO service_overrides (service_id, display_name, is_enabled, platform_key_enabled, pricing_multiplier, metering_config) VALUES
('zenrows', 'ZenRows', 1, 0, 2.0, '{"flatCostPerRequest":20}');
