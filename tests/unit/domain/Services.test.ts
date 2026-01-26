/**
 * Tests for Services - external service definitions
 */

import { describe, it, expect } from 'vitest';
import {
  Services,
  SERVICE_DEFINITIONS,
  SERVICE_URL_PATTERNS,
  SERVICE_INFO,
  detectServiceFromURL,
  getServiceInfo,
  getServiceDefinition,
  getServicesByCategory,
  getAllServiceIds,
  isKnownService,
} from '../../../src/domain/entities/Services.js';

describe('Services', () => {
  describe('SERVICE_DEFINITIONS', () => {
    it('should have all services defined', () => {
      expect(SERVICE_DEFINITIONS.length).toBeGreaterThan(30);
    });

    it('should have required fields for each service', () => {
      for (const service of SERVICE_DEFINITIONS) {
        expect(service.id).toBeDefined();
        expect(service.name).toBeDefined();
        expect(service.category).toBeDefined();
        expect(service.urlPattern).toBeInstanceOf(RegExp);
        expect(service.baseURL).toBeDefined();
      }
    });

    it('should have unique service IDs', () => {
      const ids = SERVICE_DEFINITIONS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid categories', () => {
      const validCategories = [
        'communication',
        'development',
        'productivity',
        'crm',
        'payments',
        'cloud',
        'storage',
        'email',
        'monitoring',
        'other',
      ];

      for (const service of SERVICE_DEFINITIONS) {
        expect(validCategories).toContain(service.category);
      }
    });
  });

  describe('Services constant', () => {
    it('should have Slack service', () => {
      expect(Services.Slack).toBe('slack');
    });

    it('should have GitHub service', () => {
      expect(Services.Github).toBe('github');
    });

    it('should have Jira service', () => {
      expect(Services.Jira).toBe('jira');
    });

    it('should have Notion service', () => {
      expect(Services.Notion).toBe('notion');
    });

    it('should have Stripe service', () => {
      expect(Services.Stripe).toBe('stripe');
    });

    it('should convert kebab-case to PascalCase', () => {
      expect(Services.MicrosoftTeams).toBe('microsoft-teams');
      expect(Services.GoogleWorkspace).toBe('google-workspace');
      expect(Services.Microsoft365).toBe('microsoft-365');
    });
  });

  describe('SERVICE_URL_PATTERNS', () => {
    it('should have same count as SERVICE_DEFINITIONS', () => {
      expect(SERVICE_URL_PATTERNS.length).toBe(SERVICE_DEFINITIONS.length);
    });

    it('should derive from SERVICE_DEFINITIONS', () => {
      for (const pattern of SERVICE_URL_PATTERNS) {
        const def = SERVICE_DEFINITIONS.find((d) => d.id === pattern.service);
        expect(def).toBeDefined();
        expect(pattern.pattern).toEqual(def!.urlPattern);
      }
    });
  });

  describe('SERVICE_INFO', () => {
    it('should have entries for all services', () => {
      expect(Object.keys(SERVICE_INFO).length).toBe(SERVICE_DEFINITIONS.length);
    });

    it('should derive from SERVICE_DEFINITIONS', () => {
      for (const [id, info] of Object.entries(SERVICE_INFO)) {
        const def = SERVICE_DEFINITIONS.find((d) => d.id === id);
        expect(def).toBeDefined();
        expect(info.name).toBe(def!.name);
        expect(info.category).toBe(def!.category);
        expect(info.baseURL).toBe(def!.baseURL);
      }
    });
  });

  describe('detectServiceFromURL', () => {
    it('should detect Slack from URL', () => {
      expect(detectServiceFromURL('https://slack.com/api')).toBe('slack');
      expect(detectServiceFromURL('https://hooks.slack.com/services')).toBe('slack');
    });

    it('should detect GitHub from URL', () => {
      expect(detectServiceFromURL('https://api.github.com')).toBe('github');
      expect(detectServiceFromURL('https://api.github.com/repos/owner/repo')).toBe('github');
    });

    it('should detect Jira from URL', () => {
      expect(detectServiceFromURL('https://mycompany.atlassian.net/jira')).toBe('jira');
      expect(detectServiceFromURL('https://jira.example.com')).toBe('jira');
    });

    it('should detect Discord from URL', () => {
      expect(detectServiceFromURL('https://discord.com/api/v10')).toBe('discord');
      expect(detectServiceFromURL('https://discordapp.com/api')).toBe('discord');
    });

    it('should detect Stripe from URL', () => {
      expect(detectServiceFromURL('https://api.stripe.com/v1')).toBe('stripe');
    });

    it('should detect Notion from URL', () => {
      expect(detectServiceFromURL('https://api.notion.com/v1')).toBe('notion');
    });

    it('should detect Salesforce from URL', () => {
      expect(detectServiceFromURL('https://myorg.salesforce.com/services')).toBe('salesforce');
      expect(detectServiceFromURL('https://myorg.my.salesforce.com')).toBe('salesforce');
    });

    it('should be case-insensitive', () => {
      expect(detectServiceFromURL('https://API.GITHUB.COM')).toBe('github');
      expect(detectServiceFromURL('https://Slack.Com/api')).toBe('slack');
    });

    it('should return undefined for unknown URLs', () => {
      expect(detectServiceFromURL('https://unknown.example.com')).toBeUndefined();
      expect(detectServiceFromURL('https://my-custom-api.io')).toBeUndefined();
    });
  });

  describe('getServiceInfo', () => {
    it('should return service info for known service', () => {
      const info = getServiceInfo('slack');
      expect(info).toBeDefined();
      expect(info?.name).toBe('Slack');
      expect(info?.category).toBe('communication');
      expect(info?.baseURL).toBe('https://slack.com/api');
    });

    it('should return undefined for unknown service', () => {
      expect(getServiceInfo('unknown-service')).toBeUndefined();
    });

    it('should include docsURL when available', () => {
      const slackInfo = getServiceInfo('slack');
      expect(slackInfo?.docsURL).toBe('https://api.slack.com/methods');

      const githubInfo = getServiceInfo('github');
      expect(githubInfo?.docsURL).toBe('https://docs.github.com/en/rest');
    });

    it('should include commonScopes when available', () => {
      const slackInfo = getServiceInfo('slack');
      expect(slackInfo?.commonScopes).toContain('chat:write');

      const githubInfo = getServiceInfo('github');
      expect(githubInfo?.commonScopes).toContain('repo');
    });
  });

  describe('getServiceDefinition', () => {
    it('should return full definition for known service', () => {
      const def = getServiceDefinition('github');
      expect(def).toBeDefined();
      expect(def?.id).toBe('github');
      expect(def?.name).toBe('GitHub');
      expect(def?.urlPattern).toBeInstanceOf(RegExp);
    });

    it('should return undefined for unknown service', () => {
      expect(getServiceDefinition('unknown')).toBeUndefined();
    });
  });

  describe('getServicesByCategory', () => {
    it('should return communication services', () => {
      const services = getServicesByCategory('communication');
      expect(services.length).toBeGreaterThan(0);
      expect(services.every((s) => s.category === 'communication')).toBe(true);
      expect(services.some((s) => s.id === 'slack')).toBe(true);
      expect(services.some((s) => s.id === 'discord')).toBe(true);
    });

    it('should return development services', () => {
      const services = getServicesByCategory('development');
      expect(services.length).toBeGreaterThan(0);
      expect(services.every((s) => s.category === 'development')).toBe(true);
      expect(services.some((s) => s.id === 'github')).toBe(true);
      expect(services.some((s) => s.id === 'jira')).toBe(true);
    });

    it('should return payments services', () => {
      const services = getServicesByCategory('payments');
      expect(services.some((s) => s.id === 'stripe')).toBe(true);
      expect(services.some((s) => s.id === 'paypal')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const services = getServicesByCategory('invalid-category' as any);
      expect(services).toEqual([]);
    });
  });

  describe('getAllServiceIds', () => {
    it('should return all service IDs', () => {
      const ids = getAllServiceIds();
      expect(ids.length).toBe(SERVICE_DEFINITIONS.length);
      expect(ids).toContain('slack');
      expect(ids).toContain('github');
      expect(ids).toContain('stripe');
    });
  });

  describe('isKnownService', () => {
    it('should return true for known services', () => {
      expect(isKnownService('slack')).toBe(true);
      expect(isKnownService('github')).toBe(true);
      expect(isKnownService('jira')).toBe(true);
      expect(isKnownService('stripe')).toBe(true);
    });

    it('should return false for unknown services', () => {
      expect(isKnownService('unknown')).toBe(false);
      expect(isKnownService('my-custom-service')).toBe(false);
      expect(isKnownService('')).toBe(false);
    });
  });

  describe('DRY Consistency', () => {
    it('should have consistent data across all derived exports', () => {
      // Check that all exports are derived from the same source
      for (const def of SERVICE_DEFINITIONS) {
        // Check SERVICE_URL_PATTERNS
        const pattern = SERVICE_URL_PATTERNS.find((p) => p.service === def.id);
        expect(pattern).toBeDefined();
        expect(pattern!.pattern).toEqual(def.urlPattern);

        // Check SERVICE_INFO
        const info = SERVICE_INFO[def.id];
        expect(info).toBeDefined();
        expect(info.name).toBe(def.name);
        expect(info.category).toBe(def.category);
        expect(info.baseURL).toBe(def.baseURL);
      }
    });

    it('should have no orphaned entries in derived exports', () => {
      // All SERVICE_URL_PATTERNS should reference valid service IDs
      for (const pattern of SERVICE_URL_PATTERNS) {
        const def = SERVICE_DEFINITIONS.find((d) => d.id === pattern.service);
        expect(def).toBeDefined();
      }

      // All SERVICE_INFO keys should reference valid service IDs
      for (const id of Object.keys(SERVICE_INFO)) {
        const def = SERVICE_DEFINITIONS.find((d) => d.id === id);
        expect(def).toBeDefined();
      }
    });
  });
});
