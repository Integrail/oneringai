/**
 * PlanDisplay - Main component for displaying a structured plan
 *
 * Shows:
 * - Plan header with goal and status
 * - Progress bar
 * - Task list with expandable items
 * - Approval/rejection actions when pending
 * - Auto-collapses on approve/reject
 * - Mini progress and current task when collapsed
 */

import React, { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import type { Plan, PlanTask } from '../../../preload/index';
import { TaskItem } from './TaskItem';
import { PlanProgress } from './PlanProgress';
import { PlanActions } from './PlanActions';

interface PlanDisplayProps {
  plan: Plan;
  onApprove?: () => void;
  onReject?: (reason?: string) => void;
  onFeedback?: (feedback: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  /** External control for collapsed state */
  isCollapsed?: boolean;
  /** Callback when action (approve/reject) completes */
  onActionComplete?: () => void;
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: Plan['status']): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending Approval', className: 'plan-display__status-badge--pending' };
    case 'running':
      return { label: 'Running', className: 'plan-display__status-badge--running' };
    case 'completed':
      return { label: 'Completed', className: 'plan-display__status-badge--completed' };
    case 'failed':
      return { label: 'Failed', className: 'plan-display__status-badge--failed' };
    case 'suspended':
      return { label: 'Paused', className: 'plan-display__status-badge--suspended' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'plan-display__status-badge--cancelled' };
    default:
      return { label: status, className: '' };
  }
}

/**
 * Calculate plan progress
 */
function calculateProgress(tasks: PlanTask[]): {
  completed: number;
  failed: number;
  skipped: number;
  total: number;
  percent: number;
} {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const skipped = tasks.filter((t) => t.status === 'skipped').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round(((completed + failed + skipped) / total) * 100) : 0;

  return { completed, failed, skipped, total, percent };
}

export function PlanDisplay({
  plan,
  onApprove,
  onReject,
  onFeedback,
  isApproving = false,
  isRejecting = false,
  isCollapsed: externalCollapsed,
  onActionComplete,
}: PlanDisplayProps): React.ReactElement {
  // Track if action was taken (for auto-collapse)
  const [actionTaken, setActionTaken] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Use external collapsed state if provided, otherwise use local state
  const effectiveExpanded = externalCollapsed !== undefined ? !externalCollapsed : isExpanded;

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const toggleTaskExpanded = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  // Handle approve with auto-collapse
  const handleApprove = useCallback(() => {
    if (onApprove) {
      onApprove();
      setActionTaken(true);
      setIsExpanded(false);
      onActionComplete?.();
    }
  }, [onApprove, onActionComplete]);

  // Handle reject with auto-collapse
  const handleReject = useCallback((reason?: string) => {
    if (onReject) {
      onReject(reason);
      setActionTaken(true);
      setIsExpanded(false);
      onActionComplete?.();
    }
  }, [onReject, onActionComplete]);

  // Auto-collapse when plan transitions from pending to running
  useEffect(() => {
    if (plan.status === 'running' && !actionTaken) {
      setIsExpanded(false);
    }
  }, [plan.status, actionTaken]);

  const statusBadge = getStatusBadge(plan.status);
  const progress = calculateProgress(plan.tasks);
  const showActions = plan.status === 'pending' && onApprove && onReject;

  // Find the currently running task
  const currentTask = plan.tasks.find((t) => t.status === 'in_progress');

  const containerClasses = [
    'plan-display',
    plan.status === 'pending' && 'plan-display--pending',
    plan.status === 'running' && 'plan-display--running',
    actionTaken && 'plan-display--action-completed',
    !effectiveExpanded && 'plan-display--collapsed',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="plan-display__header" onClick={toggleExpanded}>
        <div className="plan-display__header-left">
          <ClipboardList size={18} className="plan-display__icon" />
          <span className="plan-display__title">Plan</span>
          <span className={`plan-display__status-badge ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
          {/* Mini progress when collapsed and running */}
          {!effectiveExpanded && plan.status === 'running' && (
            <div className="plan-display__header-progress">
              <div className="plan-display__header-progress-bar">
                <div
                  className="plan-display__header-progress-fill plan-display__header-progress-fill--running"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span>{progress.completed}/{progress.total}</span>
            </div>
          )}
          {/* Current task name when collapsed */}
          {!effectiveExpanded && currentTask && (
            <span className="plan-display__current-task" title={currentTask.name}>
              {currentTask.name}
            </span>
          )}
        </div>
        <div className="plan-display__header-right">
          {showActions && (
            <PlanActions
              onApprove={handleApprove}
              onReject={handleReject}
              onFeedback={onFeedback}
              isApproving={isApproving}
              isRejecting={isRejecting}
            />
          )}
          <button className="plan-display__toggle" aria-label={effectiveExpanded ? 'Collapse' : 'Expand'}>
            {effectiveExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {effectiveExpanded && (
        <div className="plan-display__content">
          {/* Goal */}
          <div className="plan-display__goal">
            <span className="plan-display__goal-label">Goal:</span>
            <span className="plan-display__goal-text">{plan.goal}</span>
          </div>

          {/* Progress bar */}
          <PlanProgress progress={progress} currentTask={currentTask} />

          {/* Task list */}
          <div className="plan-display__tasks">
            <div className="plan-display__tasks-header">
              <span className="plan-display__tasks-title">Tasks</span>
              <span className="plan-display__tasks-count">
                {progress.completed}/{progress.total}
              </span>
            </div>
            <div className="plan-display__tasks-list">
              {plan.tasks.map((task, index) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  index={index}
                  allTasks={plan.tasks}
                  isExpanded={expandedTasks.has(task.id)}
                  onToggle={() => toggleTaskExpanded(task.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
