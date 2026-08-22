import { Connector } from '../../../core/Connector.js';
import { createProvider } from '../../../core/createProvider.js';
import { Vendor } from '../../../core/Vendor.js';
import { InvalidConfigError } from '../../../domain/errors/AIErrors.js';
import type { IDisposable } from '../../../domain/interfaces/IDisposable.js';
import type { ResolvedDeepSeekHost } from './DeepSeekHostRegistry.js';
import {
  DeepSeekTextProvider,
  type DeepSeekBalance,
  type DeepSeekFimRequest,
  type DeepSeekFimResponse,
} from './DeepSeekTextProvider.js';

/** Connector-backed access to DeepSeek account and completion APIs. */
export class DeepSeekAPI implements IDisposable {
  private constructor(private readonly provider: DeepSeekTextProvider) {}

  /** Resolve credentials and endpoint configuration from a named connector. */
  static for(connectorName: string): DeepSeekAPI {
    const connector = Connector.get(connectorName);
    if (connector.vendor !== Vendor.DeepSeek) {
      throw new InvalidConfigError(
        `Connector '${connectorName}' must use Vendor.DeepSeek`,
      );
    }
    const provider = createProvider(connector);
    if (!(provider instanceof DeepSeekTextProvider)) {
      throw new InvalidConfigError(
        `Connector '${connectorName}' did not resolve to the built-in DeepSeek provider`,
      );
    }
    return new DeepSeekAPI(provider);
  }

  get host(): ResolvedDeepSeekHost {
    return this.provider.host;
  }

  get isDestroyed(): boolean {
    return this.provider.isDestroyed;
  }

  listModels(): Promise<string[]> {
    return this.provider.listModels();
  }

  createFimCompletion(request: DeepSeekFimRequest): Promise<DeepSeekFimResponse> {
    return this.provider.createFimCompletion(request);
  }

  getBalance(): Promise<DeepSeekBalance> {
    return this.provider.getBalance();
  }

  destroy(): void {
    this.provider.destroy();
  }
}
