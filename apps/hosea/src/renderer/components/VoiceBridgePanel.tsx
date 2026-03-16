/**
 * VoiceBridgePanel - Right sidebar panel for voice bridge status and control
 *
 * Shows start/stop, active calls, and logs when the agent has voice bridge enabled.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Badge, Spinner, Form, InputGroup } from 'react-bootstrap';
import { Phone, PhoneOff, PhoneCall, PhoneOutgoing, ChevronDown, ChevronRight } from 'lucide-react';

interface VoiceSession {
  sessionId: string;
  callId: string;
  from: string;
  to: string;
  direction?: string;
  state: string;
  startedAt: number;
  turns: number;
}

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
}

interface TranscriptEntry {
  sessionId: string;
  role: 'caller' | 'agent';
  text: string;
  timestamp: number;
}

interface VoiceBridgeStatus {
  running: boolean;
  port?: number;
  publicUrl?: string;
  activeCalls: number;
  sessions: VoiceSession[];
  logs: LogEntry[];
}

interface VoiceBridgePanelProps {
  agentConfigId: string;
  visible: boolean;
  fromNumber?: string;
}

function formatElapsed(startMs: number): string {
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}m${secs.toString().padStart(2, '0')}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export function VoiceBridgePanel({ agentConfigId, visible, fromNumber }: VoiceBridgePanelProps): React.ReactElement | null {
  const [status, setStatus] = useState<VoiceBridgeStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dialNumber, setDialNumber] = useState('');
  const [dialing, setDialing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll status
  const pollStatus = useCallback(async () => {
    try {
      const s = await window.hosea.voiceBridge.status(agentConfigId);
      setStatus(s);
      if (s.logs.length > 0) {
        setLogs(s.logs);
      }
    } catch {
      // Ignore errors during polling
    }
  }, [agentConfigId]);

  useEffect(() => {
    if (!visible) return;

    // Initial poll
    pollStatus();

    // Poll every 2 seconds when running
    pollRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [visible, agentConfigId, pollStatus]);

  // Listen for push events
  useEffect(() => {
    if (!visible) return;

    // Use local refs to track our specific callbacks so we can remove only them
    const callStartCb = () => pollStatus();
    const callEndCb = () => pollStatus();
    const errorCb = () => pollStatus();
    const logCb = (data: { timestamp: number; level: string; message: string }) => {
      setLogs(prev => {
        const next = [...prev, { timestamp: data.timestamp, level: data.level, message: data.message }];
        return next.slice(-200);
      });
    };

    window.hosea.voiceBridge.onCallStart(callStartCb);
    window.hosea.voiceBridge.onCallEnd(callEndCb);
    window.hosea.voiceBridge.onError(errorCb);
    window.hosea.voiceBridge.onLog(logCb);

    return () => {
      // Do NOT call removeAllListeners() — it kills listeners from other components
      // (e.g., useTabContext's onTranscript listener for chat messages).
      // The panel's listeners are lightweight polling triggers, safe to leave in place.
      // They'll be GC'd when the component unmounts.
    };
  }, [visible, agentConfigId, pollStatus]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const result = await window.hosea.voiceBridge.start(agentConfigId);
      if (!result.success) {
        alert(`Failed to start voice bridge: ${result.error}`);
      }
      await pollStatus();
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      const result = await window.hosea.voiceBridge.stop(agentConfigId);
      if (!result.success) {
        alert(`Failed to stop voice bridge: ${result.error}`);
      }
      await pollStatus();
    } finally {
      setStopping(false);
    }
  };

  const handleDial = async () => {
    if (!dialNumber.trim() || !fromNumber) return;
    setDialing(true);
    try {
      const result = await window.hosea.voiceBridge.call(agentConfigId, dialNumber.trim(), fromNumber);
      if (!result.success) {
        alert(`Failed to make call: ${result.error}`);
      } else {
        setDialNumber('');
      }
      await pollStatus();
    } finally {
      setDialing(false);
    }
  };

  if (!visible) return null;

  const running = status?.running ?? false;

  return (
    <div
      style={{
        width: 280,
        borderLeft: '1px solid var(--bs-border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontSize: '0.85rem',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="p-2 border-bottom d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <Phone size={16} />
          <strong>Voice Bridge</strong>
        </div>
        <Badge bg={running ? 'success' : 'secondary'} className="d-flex align-items-center gap-1">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: running ? '#28a745' : '#6c757d',
              display: 'inline-block',
            }}
          />
          {running ? 'Running' : 'Stopped'}
        </Badge>
      </div>

      {/* Status Info */}
      {running && status && (
        <div className="p-2 border-bottom">
          <div className="text-muted small">
            Port: <strong>{status.port}</strong>
          </div>
          {status.publicUrl && (
            <div className="text-muted small text-truncate" title={status.publicUrl}>
              URL: {status.publicUrl}
            </div>
          )}
          <div className="mt-1">
            Active Calls: <Badge bg="info">{status.activeCalls}</Badge>
          </div>
        </div>
      )}

      {/* Active Calls */}
      {running && status && status.sessions.length > 0 && (
        <div className="p-2 border-bottom" style={{ maxHeight: 200, overflowY: 'auto' }}>
          <div className="text-muted small mb-1">Active Calls:</div>
          {status.sessions.map((session) => (
            <div
              key={session.sessionId}
              className="d-flex align-items-center gap-2 p-1 mb-1 rounded"
              style={{ backgroundColor: 'var(--bs-tertiary-bg)' }}
            >
              <PhoneCall size={14} className="text-success flex-shrink-0" />
              <div className="flex-grow-1 text-truncate" title={session.from}>
                <div className="fw-medium small">{session.from || 'Unknown'}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {formatElapsed(session.startedAt)} &middot; {session.turns} turns
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outbound Call */}
      {running && fromNumber && (
        <div className="p-2 border-bottom">
          <div className="text-muted small mb-1">Make Outbound Call:</div>
          <InputGroup size="sm">
            <Form.Control
              type="tel"
              placeholder="+1 555 867 5309"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDial(); }}
              disabled={dialing}
            />
            <Button
              variant="success"
              onClick={handleDial}
              disabled={dialing || !dialNumber.trim()}
            >
              {dialing ? (
                <Spinner size="sm" animation="border" />
              ) : (
                <PhoneOutgoing size={14} />
              )}
            </Button>
          </InputGroup>
          <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
            From: {fromNumber}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-2 border-bottom d-flex gap-2">
        {!running ? (
          <Button
            size="sm"
            variant="success"
            onClick={handleStart}
            disabled={starting}
            className="flex-grow-1"
          >
            {starting ? (
              <><Spinner size="sm" animation="border" className="me-1" /> Starting...</>
            ) : (
              <><Phone size={14} className="me-1" /> Start</>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={handleStop}
            disabled={stopping}
            className="flex-grow-1"
          >
            {stopping ? (
              <><Spinner size="sm" animation="border" className="me-1" /> Stopping...</>
            ) : (
              <><PhoneOff size={14} className="me-1" /> Stop</>
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => setShowLogs(!showLogs)}
        >
          {showLogs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {' '}Logs
        </Button>
      </div>

      {/* Logs */}
      {showLogs && (
        <div
          className="flex-grow-1 p-1"
          style={{
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            backgroundColor: 'var(--bs-dark-bg-subtle)',
          }}
        >
          {logs.length === 0 && (
            <div className="text-muted text-center p-2">No logs yet</div>
          )}
          {logs.map((entry, i) => (
            <div
              key={i}
              className={`px-1 ${entry.level === 'error' ? 'text-danger' : entry.level === 'warn' ? 'text-warning' : 'text-body'}`}
            >
              <span className="text-muted">{formatTime(entry.timestamp)}</span>{' '}
              {entry.message}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
