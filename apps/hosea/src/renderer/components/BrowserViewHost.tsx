/**
 * BrowserViewHost - Component for embedding BrowserView in Dynamic UI
 *
 * This component reserves space for a BrowserView overlay and communicates
 * with the main process to position the BrowserView over this element.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Spinner, Button, Form } from 'react-bootstrap';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface BrowserViewHostProps {
  /** Agent instance ID - used to identify the BrowserView */
  instanceId: string;
  /** Show URL bar overlay (default: true) */
  showUrlBar?: boolean;
  /** Show navigation buttons (default: true) */
  showNavButtons?: boolean;
  /** Current URL (from browser state) */
  currentUrl?: string;
  /** Current page title */
  pageTitle?: string;
  /** Whether page is loading */
  isLoading?: boolean;
  /** Minimum height for the browser view */
  minHeight?: number;
}

interface DetectedOverlay {
  type: 'modal' | 'popup' | 'cookie_consent' | 'notification' | 'unknown';
  selector: string;
  title?: string;
  text?: string;
  buttons: string[];
}

interface BrowserState {
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error?: string;
  hasOverlay?: boolean;
  overlay?: DetectedOverlay;
}

export function BrowserViewHost({
  instanceId,
  showUrlBar = true,
  showNavButtons = true,
  currentUrl = '',
  pageTitle = '',
  isLoading = false,
  minHeight = 300,
}: BrowserViewHostProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [browserState, setBrowserState] = useState<BrowserState>({
    url: currentUrl,
    title: pageTitle,
    isLoading,
    canGoBack: false,
    canGoForward: false,
  });
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [isAttached, setIsAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when props change (e.g., when Dynamic UI content is updated)
  useEffect(() => {
    if (currentUrl) {
      setBrowserState((prev) => {
        // Only update if URL actually changed
        if (prev.url === currentUrl) return prev;
        return {
          ...prev,
          url: currentUrl,
          title: pageTitle || prev.title,
          isLoading: isLoading ?? prev.isLoading,
        };
      });
      setUrlInput(currentUrl);
    }
  }, [currentUrl, pageTitle, isLoading]);

  // Update bounds when container resizes or moves
  const updateBounds = useCallback(() => {
    if (!containerRef.current || !isAttached) return;

    const rect = containerRef.current.getBoundingClientRect();
    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };

    window.hosea.browser.updateBounds(instanceId, bounds).catch((err) => {
      console.error('[BrowserViewHost] Failed to update bounds:', err);
    });
  }, [instanceId, isAttached]);

  // Attach BrowserView when component mounts
  useEffect(() => {
    if (!containerRef.current) return;

    const attach = async () => {
      try {
        const rect = containerRef.current!.getBoundingClientRect();
        const bounds = {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };

        await window.hosea.browser.attach(instanceId, bounds);
        setIsAttached(true);
        setError(null);

        // Get initial state
        const state = await window.hosea.browser.getState(instanceId);
        if (state.success) {
          setBrowserState({
            url: state.url || '',
            title: state.title || '',
            isLoading: state.isLoading || false,
            canGoBack: state.canGoBack || false,
            canGoForward: state.canGoForward || false,
          });
          setUrlInput(state.url || '');
        }
      } catch (err) {
        console.error('[BrowserViewHost] Failed to attach:', err);
        setError(`Failed to attach browser: ${err}`);
      }
    };

    attach();

    // Detach when component unmounts
    return () => {
      window.hosea.browser.detach(instanceId).catch((err) => {
        console.error('[BrowserViewHost] Failed to detach:', err);
      });
    };
  }, [instanceId]);

  // Update bounds on resize
  useEffect(() => {
    if (!containerRef.current || !isAttached) return;

    const resizeObserver = new ResizeObserver(() => {
      updateBounds();
    });

    resizeObserver.observe(containerRef.current);

    // Also update on scroll (in case container moves)
    const handleScroll = () => updateBounds();
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isAttached, updateBounds]);

  // Listen for browser state changes
  useEffect(() => {
    // Set up state change listener
    window.hosea.browser.onStateChange((stateInstanceId, state) => {
      if (stateInstanceId === instanceId) {
        setBrowserState((prev) => ({
          ...prev,
          url: state.url ?? prev.url,
          title: state.title ?? prev.title,
          isLoading: state.isLoading ?? prev.isLoading,
          canGoBack: state.canGoBack ?? prev.canGoBack,
          canGoForward: state.canGoForward ?? prev.canGoForward,
          error: state.error,
          hasOverlay: state.hasOverlay ?? prev.hasOverlay,
          overlay: state.overlay ?? prev.overlay,
        }));
        if (state.url) {
          setUrlInput(state.url);
        }
      }
    });

    // Note: onStateChange replaces existing listeners, so no explicit cleanup needed
    // The next component that calls onStateChange will replace this listener
  }, [instanceId]);

  // Navigation handlers
  const handleGoBack = async () => {
    try {
      await window.hosea.browser.goBack(instanceId);
    } catch (err) {
      console.error('[BrowserViewHost] Failed to go back:', err);
    }
  };

  const handleGoForward = async () => {
    try {
      await window.hosea.browser.goForward(instanceId);
    } catch (err) {
      console.error('[BrowserViewHost] Failed to go forward:', err);
    }
  };

  const handleReload = async () => {
    try {
      await window.hosea.browser.reload(instanceId);
    } catch (err) {
      console.error('[BrowserViewHost] Failed to reload:', err);
    }
  };

  const handleNavigate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    let url = urlInput.trim();
    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//i)) {
      url = `https://${url}`;
    }

    try {
      await window.hosea.browser.navigate(instanceId, url);
    } catch (err) {
      console.error('[BrowserViewHost] Failed to navigate:', err);
      setError(`Failed to navigate: ${err}`);
    }
  };

  const handleOpenExternal = () => {
    if (browserState.url) {
      window.open(browserState.url, '_blank');
    }
  };

  return (
    <div className="browser-view-host">
      {/* URL Bar */}
      {showUrlBar && (
        <div className="browser-view-host__toolbar">
          {showNavButtons && (
            <div className="browser-view-host__nav-buttons">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleGoBack}
                disabled={!browserState.canGoBack}
                title="Go back"
              >
                <ArrowLeft size={16} />
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleGoForward}
                disabled={!browserState.canGoForward}
                title="Go forward"
              >
                <ArrowRight size={16} />
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleReload}
                disabled={browserState.isLoading}
                title="Reload"
              >
                <RotateCw size={16} className={browserState.isLoading ? 'spinning' : ''} />
              </Button>
            </div>
          )}

          <Form onSubmit={handleNavigate} className="browser-view-host__url-form">
            <div className="browser-view-host__url-input-wrapper">
              <Globe size={14} className="browser-view-host__url-icon" />
              <Form.Control
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter URL..."
                className="browser-view-host__url-input"
                size="sm"
              />
              {browserState.isLoading && (
                <Spinner
                  animation="border"
                  size="sm"
                  className="browser-view-host__loading-spinner"
                />
              )}
            </div>
          </Form>

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleOpenExternal}
            disabled={!browserState.url}
            title="Open in external browser"
          >
            <ExternalLink size={16} />
          </Button>
        </div>
      )}

      {/* Page title */}
      {browserState.title && (
        <div className="browser-view-host__title">
          {browserState.title}
        </div>
      )}

      {/* Error display */}
      {(error || browserState.error) && (
        <div className="browser-view-host__error">
          <AlertCircle size={16} />
          <span>{error || browserState.error}</span>
        </div>
      )}

      {/* Overlay notification */}
      {browserState.hasOverlay && browserState.overlay && (
        <div className="browser-view-host__overlay-notice">
          <AlertTriangle size={16} />
          <span>
            <strong>{browserState.overlay.type.replace('_', ' ')}</strong>
            {browserState.overlay.title && `: ${browserState.overlay.title}`}
            {browserState.overlay.buttons.length > 0 && (
              <span className="browser-view-host__overlay-buttons">
                {' '}— Buttons: {browserState.overlay.buttons.slice(0, 3).join(', ')}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Browser View Container - BrowserView will be overlaid here */}
      <div
        ref={containerRef}
        className="browser-view-host__container"
        style={{ minHeight: `${minHeight}px` }}
      >
        {!isAttached && (
          <div className="browser-view-host__placeholder">
            <Spinner animation="border" />
            <span>Initializing browser...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowserViewHost;
