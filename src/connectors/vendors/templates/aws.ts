/**
 * AWS Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const awsTemplate: VendorTemplate = {
  id: 'aws',
  name: 'Amazon Web Services',
  serviceType: 'aws',
  baseURL: 'https://aws.amazon.com',
  docsURL: 'https://docs.aws.amazon.com/',
  credentialsSetupURL: 'https://console.aws.amazon.com/iam/home#/security_credentials',
  category: 'cloud',
  notes: 'AWS uses signature-based auth. baseURL varies by service (e.g., s3.amazonaws.com)',

  authTemplates: [
    {
      id: 'access-key',
      name: 'Access Key',
      type: 'api_key',
      description: 'IAM access key pair. Create at IAM > Users > Security credentials or root Security credentials',
      requiredFields: ['accessKeyId', 'secretAccessKey'],
      optionalFields: ['region'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'AWS4-HMAC-SHA256',
      },
    },
  ],
};
