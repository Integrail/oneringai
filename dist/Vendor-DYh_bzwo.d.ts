/**
 * Supported AI Vendors
 *
 * Use this enum instead of string literals for type safety.
 * These map to specific provider implementations.
 */
declare const Vendor: {
    readonly OpenAI: "openai";
    readonly Anthropic: "anthropic";
    readonly Google: "google";
    readonly GoogleVertex: "google-vertex";
    readonly Groq: "groq";
    readonly Together: "together";
    readonly Perplexity: "perplexity";
    readonly Grok: "grok";
    readonly DeepSeek: "deepseek";
    readonly Mistral: "mistral";
    readonly Ollama: "ollama";
    readonly Custom: "custom";
};
type Vendor = (typeof Vendor)[keyof typeof Vendor];
/**
 * All vendor values as array (useful for validation)
 */
declare const VENDORS: ("openai" | "anthropic" | "google" | "google-vertex" | "groq" | "together" | "perplexity" | "grok" | "deepseek" | "mistral" | "ollama" | "custom")[];
/**
 * Check if a string is a valid vendor
 */
declare function isVendor(value: string): value is Vendor;

export { Vendor as V, VENDORS as a, isVendor as i };
