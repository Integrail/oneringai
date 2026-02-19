/**
 * IRoutineDefinitionStorage - Storage interface for routine definitions.
 *
 * Follows the same userId-optional pattern as ICustomToolStorage and IUserInfoStorage.
 * When userId is undefined, defaults to 'default' user in storage implementation.
 */

import type { RoutineDefinition } from '../entities/Routine.js';

export interface IRoutineDefinitionStorage {
  save(userId: string | undefined, definition: RoutineDefinition): Promise<void>;
  load(userId: string | undefined, id: string): Promise<RoutineDefinition | null>;
  delete(userId: string | undefined, id: string): Promise<void>;
  exists(userId: string | undefined, id: string): Promise<boolean>;
  list(userId: string | undefined, options?: {
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<RoutineDefinition[]>;
  getPath(userId: string | undefined): string;
}
