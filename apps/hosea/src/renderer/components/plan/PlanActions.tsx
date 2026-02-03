/**
 * PlanActions - Approval, rejection, and feedback buttons for pending plans
 *
 * Shows:
 * - Approve button (green)
 * - Reject button (red) with optional reason input
 * - Suggest Changes button (blue) for sending feedback to the agent
 */

import React, { useState, useCallback } from 'react';
import { Check, X, Loader, MessageSquare } from 'lucide-react';

interface PlanActionsProps {
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onFeedback?: (feedback: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function PlanActions({
  onApprove,
  onReject,
  onFeedback,
  isApproving = false,
  isRejecting = false,
}: PlanActionsProps): React.ReactElement {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

  const handleApprove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isApproving && !isRejecting) {
        onApprove();
      }
    },
    [onApprove, isApproving, isRejecting]
  );

  const handleRejectClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isApproving && !isRejecting) {
        setShowRejectInput(true);
        setShowFeedbackInput(false);
      }
    },
    [isApproving, isRejecting]
  );

  const handleRejectConfirm = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (!isApproving && !isRejecting) {
        onReject(rejectReason || undefined);
        setShowRejectInput(false);
        setRejectReason('');
      }
    },
    [onReject, rejectReason, isApproving, isRejecting]
  );

  const handleRejectCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRejectInput(false);
    setRejectReason('');
  }, []);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRejectConfirm(e);
      } else if (e.key === 'Escape') {
        setShowRejectInput(false);
        setRejectReason('');
      }
    },
    [handleRejectConfirm]
  );

  // Feedback handlers
  const handleFeedbackClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isApproving && !isRejecting && onFeedback) {
        setShowFeedbackInput(true);
        setShowRejectInput(false);
      }
    },
    [isApproving, isRejecting, onFeedback]
  );

  const handleFeedbackConfirm = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isApproving && !isRejecting && onFeedback && feedbackText.trim()) {
        onFeedback(feedbackText.trim());
        setShowFeedbackInput(false);
        setFeedbackText('');
      }
    },
    [onFeedback, feedbackText, isApproving, isRejecting]
  );

  const handleFeedbackCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFeedbackInput(false);
    setFeedbackText('');
  }, []);

  const handleFeedbackKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        handleFeedbackConfirm(e as unknown as React.MouseEvent);
      } else if (e.key === 'Escape') {
        setShowFeedbackInput(false);
        setFeedbackText('');
      }
    },
    [handleFeedbackConfirm]
  );

  const isDisabled = isApproving || isRejecting;

  return (
    <div className="plan-actions" onClick={(e) => e.stopPropagation()}>
      {/* Normal state - show all buttons */}
      {!showRejectInput && !showFeedbackInput && (
        <>
          <button
            className="plan-actions__btn plan-actions__btn--approve"
            onClick={handleApprove}
            disabled={isDisabled}
            title="Approve plan"
          >
            {isApproving ? (
              <Loader size={14} className="plan-actions__icon plan-actions__icon--spin" />
            ) : (
              <Check size={14} className="plan-actions__icon" />
            )}
            <span>Approve</span>
          </button>
          <button
            className="plan-actions__btn plan-actions__btn--reject"
            onClick={handleRejectClick}
            disabled={isDisabled}
            title="Reject plan"
          >
            {isRejecting ? (
              <Loader size={14} className="plan-actions__icon plan-actions__icon--spin" />
            ) : (
              <X size={14} className="plan-actions__icon" />
            )}
            <span>Reject</span>
          </button>
          {onFeedback && (
            <button
              className="plan-actions__btn plan-actions__btn--feedback"
              onClick={handleFeedbackClick}
              disabled={isDisabled}
              title="Suggest changes to the plan"
            >
              <MessageSquare size={14} className="plan-actions__icon" />
              <span>Suggest Changes</span>
            </button>
          )}
        </>
      )}

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="plan-actions__reject-form">
          <input
            type="text"
            className="plan-actions__reject-input"
            placeholder="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onKeyDown={handleInputKeyDown}
            autoFocus
          />
          <button
            className="plan-actions__btn plan-actions__btn--confirm"
            onClick={handleRejectConfirm}
            disabled={isDisabled}
            title="Confirm rejection"
          >
            <Check size={14} />
          </button>
          <button
            className="plan-actions__btn plan-actions__btn--cancel"
            onClick={handleRejectCancel}
            disabled={isDisabled}
            title="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Feedback input form */}
      {showFeedbackInput && (
        <div className="plan-actions__feedback-form">
          <textarea
            className="plan-actions__feedback-textarea"
            placeholder="Describe your suggested changes... (Ctrl+Enter to submit)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            onKeyDown={handleFeedbackKeyDown}
            autoFocus
          />
          <div className="plan-actions__feedback-buttons">
            <button
              className="plan-actions__btn plan-actions__btn--cancel"
              onClick={handleFeedbackCancel}
              disabled={isDisabled}
              title="Cancel"
            >
              <X size={14} />
            </button>
            <button
              className="plan-actions__btn plan-actions__btn--confirm"
              onClick={handleFeedbackConfirm}
              disabled={isDisabled || !feedbackText.trim()}
              title="Send feedback"
            >
              <Check size={14} />
              <span>Send</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
