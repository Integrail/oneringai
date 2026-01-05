/**
 * Base provider interface
 */

export interface ProviderCapabilities {
  text: boolean;
  images: boolean;
  videos: boolean;
  audio: boolean;
}

export interface IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /**
   * Validate that the provider configuration is correct
   */
  validateConfig(): Promise<boolean>;
}
