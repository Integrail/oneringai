/**
 * TaskItem - Individual task display component
 *
 * Shows:
 * - Status icon with left border color
 * - Task name and description
 * - Dependencies as chips
 * - Expandable details (validation criteria, result)
 */

import React from 'react';
import {
  Check,
  Circle,
  Loader,
  X,
  Lock,
  SkipForward,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { PlanTask } from '../../../preload/index';

interface TaskItemProps {
  task: PlanTask;
  index: number;
  allTasks: PlanTask[];
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Get status icon and styling
 */
function getStatusInfo(status: PlanTask['status']): {
  icon: React.ReactNode;
  className: string;
  label: string;
} {
  switch (status) {
    case 'completed':
      return {
        icon: <Check size={14} className="task-item__status-icon" />,
        className: 'task-item--completed',
        label: 'Completed',
      };
    case 'in_progress':
      return {
        icon: <Loader size={14} className="task-item__status-icon task-item__status-icon--spin" />,
        className: 'task-item--running',
        label: 'In Progress',
      };
    case 'failed':
      return {
        icon: <X size={14} className="task-item__status-icon" />,
        className: 'task-item--failed',
        label: 'Failed',
      };
    case 'blocked':
      return {
        icon: <Lock size={14} className="task-item__status-icon" />,
        className: 'task-item--blocked',
        label: 'Blocked',
      };
    case 'skipped':
      return {
        icon: <SkipForward size={14} className="task-item__status-icon" />,
        className: 'task-item--skipped',
        label: 'Skipped',
      };
    case 'cancelled':
      return {
        icon: <X size={14} className="task-item__status-icon" />,
        className: 'task-item--cancelled',
        label: 'Cancelled',
      };
    case 'waiting_external':
      return {
        icon: <Loader size={14} className="task-item__status-icon" />,
        className: 'task-item--waiting',
        label: 'Waiting',
      };
    case 'pending':
    default:
      return {
        icon: <Circle size={14} className="task-item__status-icon" />,
        className: 'task-item--pending',
        label: 'Pending',
      };
  }
}

/**
 * Resolve task IDs to names for display
 */
function getDependencyNames(dependsOn: string[], allTasks: PlanTask[]): string[] {
  return dependsOn.map((depId) => {
    const depTask = allTasks.find((t) => t.id === depId);
    return depTask?.name || depId;
  });
}

export function TaskItem({
  task,
  index,
  allTasks,
  isExpanded,
  onToggle,
}: TaskItemProps): React.ReactElement {
  const statusInfo = getStatusInfo(task.status);
  const dependencyNames = getDependencyNames(task.dependsOn, allTasks);
  const hasDetails =
    task.validation?.completionCriteria?.length ||
    task.result ||
    task.description.length > 100;

  return (
    <div className={`task-item ${statusInfo.className}`}>
      <div className="task-item__main" onClick={hasDetails ? onToggle : undefined}>
        <div className="task-item__status">
          {statusInfo.icon}
        </div>
        <div className="task-item__content">
          <div className="task-item__header">
            <span className="task-item__index">{index + 1}.</span>
            <span className="task-item__name">{task.name}</span>
            {task.status !== 'pending' && (
              <span className="task-item__status-label">[{statusInfo.label}]</span>
            )}
          </div>
          <div className="task-item__meta">
            {dependencyNames.length > 0 ? (
              <span className="task-item__deps">
                depends on:{' '}
                {dependencyNames.map((name, i) => (
                  <span key={i} className="task-item__dep-chip">
                    {name}
                  </span>
                ))}
              </span>
            ) : (
              <span className="task-item__deps task-item__deps--none">No dependencies</span>
            )}
            {task.validation?.completionCriteria?.length && (
              <span className="task-item__validation-hint">
                {task.validation.completionCriteria.length} validation criteria
              </span>
            )}
          </div>
        </div>
        {hasDetails && (
          <div className="task-item__expand">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="task-item__details">
          {/* Description */}
          <div className="task-item__description">
            <span className="task-item__detail-label">Description:</span>
            <span className="task-item__detail-value">{task.description}</span>
          </div>

          {/* Validation criteria */}
          {task.validation?.completionCriteria?.length && (
            <div className="task-item__criteria">
              <span className="task-item__detail-label">Validation Criteria:</span>
              <ul className="task-item__criteria-list">
                {task.validation.completionCriteria.map((criterion, i) => (
                  <li key={i} className="task-item__criterion">
                    {criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div className="task-item__result">
              <span className="task-item__detail-label">Result:</span>
              {task.result.success ? (
                <span className="task-item__result-success">
                  {typeof task.result.output === 'string'
                    ? task.result.output.substring(0, 200) +
                      (task.result.output.length > 200 ? '...' : '')
                    : JSON.stringify(task.result.output).substring(0, 200)}
                </span>
              ) : (
                <span className="task-item__result-error">
                  Error: {task.result.error}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
