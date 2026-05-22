/**
 * Geolocation Vendor Templates (ipapi.co)
 *
 * ipapi.co authenticates by appending the API key as a `?key=` query
 * parameter. Uses the `queryParamName` field on APIKeyConnectorAuth so
 * `connector.fetch()` injects the key into the URL and skips the auth header.
 */
import type { VendorTemplate } from '../types.js';

export const ipapiTemplate: VendorTemplate = {
    id: 'ipapi',
    name: 'ipapi',
    serviceType: 'ipapi',
    baseURL: 'https://ipapi.co',
    docsURL: 'https://ipapi.co/api/',
    credentialsSetupURL: 'https://ipapi.co/#pricing',
    category: 'other',
    notes:
        'IP-address-based geolocation lookup. API key is sent as the `key` query parameter.',

    authTemplates: [
        {
            id: 'api-key',
            name: 'API Key',
            type: 'api_key',
            description:
                'ipapi.co API key. Get one at ipapi.co/#pricing.',
            requiredFields: ['apiKey'],
            defaults: {
                type: 'api_key',
                queryParamName: 'key',
            },
        },
    ],
};
