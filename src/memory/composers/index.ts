/**
 * Content embedding composer module. See `types.ts` for the contract and
 * `defaults.ts` for the built-in implementations.
 */

export type {
  EntityContentComposer,
  FactContentComposer,
  ComposeContext,
} from './types.js';
export { CachedComposeContext } from './types.js';
export {
  taskContentComposer,
  eventContentComposer,
  personContentComposer,
  organizationContentComposer,
  topicContentComposer,
  projectContentComposer,
  documentContentComposer,
  clusterContentComposer,
  defaultFactContentComposer,
  DEFAULT_ENTITY_COMPOSERS,
} from './defaults.js';
