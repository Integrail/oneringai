/**
 * Auth injector — adds credentials to outgoing proxy requests
 */

export interface AuthInjection {
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
}

/**
 * Inject authentication into the outgoing request based on auth type.
 */
export function injectAuth(
  authType: string,
  apiKey: string,
  authConfig: Record<string, unknown> = {},
): AuthInjection {
  switch (authType) {
    case 'bearer':
      return { headers: { Authorization: `Bearer ${apiKey}` } };

    case 'api_key': {
      const headerName = (authConfig.headerName as string) ?? 'X-API-Key';
      return { headers: { [headerName]: apiKey } };
    }

    case 'basic': {
      const encoded = btoa(`${authConfig.username ?? ''}:${apiKey}`);
      return { headers: { Authorization: `Basic ${encoded}` } };
    }

    case 'header': {
      const name = (authConfig.headerName as string) ?? 'Authorization';
      const prefix = (authConfig.prefix as string) ?? '';
      return { headers: { [name]: prefix ? `${prefix} ${apiKey}` : apiKey } };
    }

    case 'query': {
      const paramName = (authConfig.paramName as string) ?? 'key';
      return { headers: {}, queryParams: { [paramName]: apiKey } };
    }

    default:
      return { headers: { Authorization: `Bearer ${apiKey}` } };
  }
}
