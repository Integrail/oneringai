/**
 * Base provider interface
 */
interface ProviderCapabilities {
    text: boolean;
    images: boolean;
    videos: boolean;
    audio: boolean;
}
interface IProvider {
    readonly name: string;
    readonly vendor?: string;
    readonly capabilities: ProviderCapabilities;
    /**
     * Validate that the provider configuration is correct
     */
    validateConfig(): Promise<boolean>;
}

export type { IProvider as I, ProviderCapabilities as P };
