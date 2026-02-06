import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { Alert, Button, ProgressBar } from 'react-bootstrap';

type UpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string | null }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number; bytesPerSecond?: number; transferred?: number; total?: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string };

export function UpdateNotification(): React.ReactElement | null {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.hosea.updater.onStatus((status) => {
      // Convert flat type to discriminated union
      switch (status.status) {
        case 'checking':
          setUpdateStatus({ status: 'checking' });
          break;
        case 'available':
          setUpdateStatus({ status: 'available', version: status.version!, releaseNotes: status.releaseNotes });
          break;
        case 'not-available':
          setUpdateStatus({ status: 'not-available' });
          break;
        case 'downloading':
          setUpdateStatus({
            status: 'downloading',
            percent: status.percent!,
            bytesPerSecond: status.bytesPerSecond,
            transferred: status.transferred,
            total: status.total,
          });
          break;
        case 'downloaded':
          setUpdateStatus({ status: 'downloaded', version: status.version! });
          break;
        case 'error':
          setUpdateStatus({ status: 'error', message: status.message || 'Unknown error' });
          break;
      }
    });
    return () => window.hosea.updater.removeStatusListener();
  }, []);

  // Don't show anything if dismissed or no status or not applicable
  if (dismissed || !updateStatus) return null;
  if (updateStatus.status === 'not-available') return null;
  if (updateStatus.status === 'checking') return null;

  const handleDismiss = () => setDismissed(true);

  return (
    <div className="update-notification position-fixed bottom-0 end-0 m-3" style={{ zIndex: 1050, maxWidth: '350px' }}>
      {updateStatus.status === 'available' && (
        <Alert variant="info" className="d-flex align-items-center gap-2 mb-0">
          <Download size={18} />
          <div className="flex-grow-1">
            <strong>Update Available</strong>
            <div className="small">Version {updateStatus.version} is ready to download</div>
          </div>
          <div className="d-flex gap-1">
            <Button size="sm" variant="primary" onClick={() => window.hosea.updater.download()}>
              Download
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={handleDismiss}>
              <X size={14} />
            </Button>
          </div>
        </Alert>
      )}

      {updateStatus.status === 'downloading' && (
        <Alert variant="info" className="mb-0">
          <div className="d-flex align-items-center gap-2 mb-2">
            <RefreshCw size={18} className="spin" />
            <span>Downloading update...</span>
          </div>
          <ProgressBar
            now={updateStatus.percent}
            label={`${Math.round(updateStatus.percent)}%`}
            animated
          />
          {updateStatus.bytesPerSecond && (
            <div className="small text-muted mt-1">
              {formatBytes(updateStatus.transferred || 0)} / {formatBytes(updateStatus.total || 0)}
              {' '}({formatBytes(updateStatus.bytesPerSecond)}/s)
            </div>
          )}
        </Alert>
      )}

      {updateStatus.status === 'downloaded' && (
        <Alert variant="success" className="d-flex align-items-center gap-2 mb-0">
          <CheckCircle size={18} />
          <div className="flex-grow-1">
            <strong>Update Ready</strong>
            <div className="small">Version {updateStatus.version} will be installed on restart</div>
          </div>
          <div className="d-flex gap-1">
            <Button size="sm" variant="success" onClick={() => window.hosea.updater.install()}>
              Restart Now
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={handleDismiss}>
              Later
            </Button>
          </div>
        </Alert>
      )}

      {updateStatus.status === 'error' && (
        <Alert variant="warning" className="d-flex align-items-center gap-2 mb-0">
          <AlertTriangle size={18} />
          <div className="flex-grow-1">
            <strong>Update Failed</strong>
            <div className="small">{updateStatus.message}</div>
          </div>
          <Button size="sm" variant="outline-secondary" onClick={handleDismiss}>
            <X size={14} />
          </Button>
        </Alert>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
