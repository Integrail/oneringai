/**
 * Geolocation Vendor Templates (ipinfo.io)
 *
 * ipinfo.io authenticates with a Bearer token in the Authorization header.
 * Endpoint shape: `GET /lite/{ip}` (lite plan — country-level) or
 * `GET /{ip}` (paid plans — full city/region/coordinates).
 */
import type { VendorTemplate } from '../types.js';

export const ipinfoTemplate: VendorTemplate = {
    id: 'ipinfo',
    name: 'ipinfo',
    serviceType: 'ipinfo',
    baseURL: 'https://api.ipinfo.io',
    docsURL: 'https://ipinfo.io/developers',
    credentialsSetupURL: 'https://ipinfo.io/signup',
    category: 'other',
    notes: 'IP-address-based geolocation lookup. API key sent as a Bearer token in the Authorization header.',

    authTemplates: [
        {
            id: 'api-key',
            name: 'API Key',
            type: 'api_key',
            description:
                'ipinfo.io access token. Free tier supports country-level lookups (/lite/{ip}); paid plans add city/region. Get one at ipinfo.io/signup.',
            requiredFields: ['apiKey'],
            defaults: {
                type: 'api_key',
                headerName: 'Authorization',
                headerPrefix: 'Bearer',
            },
        },
    ],
};
