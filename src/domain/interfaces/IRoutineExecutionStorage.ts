/**
 * Storage interface for routine execution records.
 *
 * Designed to be storage-agnostic — implementations can back this with
 * MongoDB, PostgreSQL, file system, etc.
 *
 * Accepts StorageUserContextInput (string | undefined | StorageUserContext) for
 * backward compatibility. Implementations use resolveStorageUserContext() to
 * normalize the input.
 */

import type {
  RoutineExecutionRecord,
  RoutineExecutionStep,
  RoutineTaskSnapshot,
} from '../entities/RoutineExecutionRecord.js';
import type { RoutineExecutionStatus } from '../entities/Routine.js';
import type { StorageUserContextInput } from './StorageContext.js';

export interface IRoutineExecutionStorage {
  /** Insert a new execution record. Returns the record ID. */
  insert(context: StorageUserContextInput, record: RoutineExecutionRecord): Promise<string>;

  /** Update top-level fields on an execution record. */
  update(
    id: string,
    updates: Partial<
      Pick<RoutineExecutionRecord, 'status' | 'progress' | 'error' | 'completedAt' | 'lastActivityAt'>
    >,
  ): Promise<void>;

  /** Append a step to the execution's steps array. */
  pushStep(id: string, step: RoutineExecutionStep): Promise<void>;

  /** Update a specific task snapshot within the execution record. */
  updateTask(id: string, taskName: string, updates: Partial<RoutineTaskSnapshot>): Promise<void>;

  /** Load a single execution record by ID. */
  load(id: string): Promise<RoutineExecutionRecord | null>;

  /** List execution records with optional filters. */
  list(
    context: StorageUserContextInput,
    options?: {
      routineId?: string;
      status?: RoutineExecutionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<RoutineExecutionRecord[]>;

  /** Check if a routine has a currently running execution. */
  hasRunning(context: StorageUserContextInput, routineId: string): Promise<boolean>;
}
