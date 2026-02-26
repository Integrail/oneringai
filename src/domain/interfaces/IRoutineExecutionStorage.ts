/**
 * Storage interface for routine execution records.
 *
 * Designed to be storage-agnostic — implementations can back this with
 * MongoDB, PostgreSQL, file system, etc.
 */

import type {
  RoutineExecutionRecord,
  RoutineExecutionStep,
  RoutineTaskSnapshot,
} from '../entities/RoutineExecutionRecord.js';
import type { RoutineExecutionStatus } from '../entities/Routine.js';

export interface IRoutineExecutionStorage {
  /** Insert a new execution record. Returns the record ID. */
  insert(userId: string | undefined, record: RoutineExecutionRecord): Promise<string>;

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
    userId: string | undefined,
    options?: {
      routineId?: string;
      status?: RoutineExecutionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<RoutineExecutionRecord[]>;

  /** Check if a routine has a currently running execution. */
  hasRunning(userId: string | undefined, routineId: string): Promise<boolean>;
}
