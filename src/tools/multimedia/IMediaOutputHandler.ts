/**
 * @deprecated Use `IMediaStorage`, `MediaStorageMetadata`, `MediaStorageResult` from
 * `@everworker/oneringai` (domain layer) instead. These aliases will be removed in the next major version.
 */

export type {
  IMediaStorage as IMediaOutputHandler,
  MediaStorageMetadata as MediaOutputMetadata,
  MediaStorageResult as MediaOutputResult,
} from '../../domain/interfaces/IMediaStorage.js';
