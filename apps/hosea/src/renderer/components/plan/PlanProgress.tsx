/**
 * PlanProgress - Progress bar component for plan execution
 *
 * Shows:
 * - Segmented progress bar (green=complete, red=failed, yellow=skipped)
 * - Current task indicator
 * - Percentage and count labels
 */

import React from 'react';
import type { PlanTask } from '../../../preload/index';

interface ProgressData {
  completed: number;
  failed: number;
  skipped: number;
  total: number;
  percent: number;
}

interface PlanProgressProps {
  progress: ProgressData;
  currentTask?: PlanTask;
}

export function PlanProgress({ progress, currentTask }: PlanProgressProps): React.ReactElement {
  const { completed, failed, skipped, total, percent } = progress;

  // Calculate segment widths
  const completedPercent = total > 0 ? (completed / total) * 100 : 0;
  const failedPercent = total > 0 ? (failed / total) * 100 : 0;
  const skippedPercent = total > 0 ? (skipped / total) * 100 : 0;

  return (
    <div className="plan-progress">
      {/* Progress bar */}
      <div className="plan-progress__bar">
        <div className="plan-progress__track">
          {completedPercent > 0 && (
            <div
              className="plan-progress__segment plan-progress__segment--completed"
              style={{ width: `${completedPercent}%` }}
            />
          )}
          {failedPercent > 0 && (
            <div
              className="plan-progress__segment plan-progress__segment--failed"
              style={{ width: `${failedPercent}%` }}
            />
          )}
          {skippedPercent > 0 && (
            <div
              className="plan-progress__segment plan-progress__segment--skipped"
              style={{ width: `${skippedPercent}%` }}
            />
          )}
        </div>
        <div className="plan-progress__label">
          <span className="plan-progress__percent">{percent}%</span>
          <span className="plan-progress__count">
            ({completed + failed + skipped}/{total})
          </span>
        </div>
      </div>

      {/* Current task indicator */}
      {currentTask && (
        <div className="plan-progress__current">
          <span className="plan-progress__current-label">Currently running:</span>
          <span className="plan-progress__current-task">{currentTask.name}</span>
        </div>
      )}

      {/* Legend for status colors */}
      {(completed > 0 || failed > 0 || skipped > 0) && (
        <div className="plan-progress__legend">
          {completed > 0 && (
            <span className="plan-progress__legend-item">
              <span className="plan-progress__legend-dot plan-progress__legend-dot--completed" />
              <span>{completed} completed</span>
            </span>
          )}
          {failed > 0 && (
            <span className="plan-progress__legend-item">
              <span className="plan-progress__legend-dot plan-progress__legend-dot--failed" />
              <span>{failed} failed</span>
            </span>
          )}
          {skipped > 0 && (
            <span className="plan-progress__legend-item">
              <span className="plan-progress__legend-dot plan-progress__legend-dot--skipped" />
              <span>{skipped} skipped</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
