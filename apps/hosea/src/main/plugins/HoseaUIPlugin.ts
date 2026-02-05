/**
 * HoseaUIPlugin
 *
 * Tool execution plugin that emits Dynamic UI content for browser tools.
 * When browser tools execute, this plugin sends UI events to show the browser view
 * in the Hosea UI.
 *
 * This plugin runs in the tool execution pipeline and intercepts browser tool results
 * to emit Dynamic UI content via the provided callback.
 */

import type {
  IToolExecutionPlugin,
  PluginExecutionContext,
  BeforeExecuteResult,
} from '@everworker/oneringai';

/**
 * Dynamic UI content structure for browser elements
 */
export interface BrowserDynamicUIContent {
  type: 'display';
  title: string;
  elements: Array<{
    type: 'browser';
    id: string;
    instanceId: string;
    showUrlBar?: boolean;
    showNavButtons?: boolean;
    currentUrl?: string;
    pageTitle?: string;
    isLoading?: boolean;
  }>;
}

/**
 * Generic Dynamic UI content type (can be extended for other UI types)
 */
export type DynamicUIContent = BrowserDynamicUIContent;

/**
 * Configuration options for HoseaUIPlugin
 */
export interface HoseaUIPluginOptions {
  /**
   * Callback to emit Dynamic UI content to the renderer.
   * Called when browser tools execute successfully and need to show UI.
   *
   * @param instanceId - The agent instance ID
   * @param content - The Dynamic UI content to display
   */
  emitDynamicUI: (instanceId: string, content: DynamicUIContent) => void;

  /**
   * Function to get the current agent instance ID.
   * Called for each tool execution to determine which instance the UI belongs to.
   */
  getInstanceId: () => string;
}

/**
 * Browser tool names that should trigger UI updates
 */
const BROWSER_UI_TOOLS = new Set([
  'browser_navigate',
  'browser_go_back',
  'browser_go_forward',
  'browser_reload',
]);

/**
 * HoseaUIPlugin - Emits Dynamic UI content for browser tools.
 *
 * This plugin intercepts tool execution results and emits UI events
 * when browser tools are used. The UI events are sent to the renderer
 * to show the browser view.
 *
 * @example
 * ```typescript
 * const plugin = new HoseaUIPlugin({
 *   emitDynamicUI: (instanceId, content) => {
 *     mainWindow?.webContents.send('agent:stream-chunk', instanceId, {
 *       type: 'ui:set_dynamic_content',
 *       content,
 *     });
 *   },
 *   getInstanceId: () => currentInstanceId,
 * });
 *
 * agent.tools.executionPipeline.use(plugin);
 * ```
 */
export class HoseaUIPlugin implements IToolExecutionPlugin {
  readonly name = 'hosea-ui';
  readonly priority = 200; // Run late, after other plugins

  private emitDynamicUI: HoseaUIPluginOptions['emitDynamicUI'];
  private getInstanceId: HoseaUIPluginOptions['getInstanceId'];

  constructor(options: HoseaUIPluginOptions) {
    this.emitDynamicUI = options.emitDynamicUI;
    this.getInstanceId = options.getInstanceId;
  }

  /**
   * Store instance ID in context metadata before execution.
   * This ensures we have the correct instance ID even if it changes during execution.
   */
  async beforeExecute(ctx: PluginExecutionContext): Promise<BeforeExecuteResult> {
    // Only track instance ID for browser tools
    if (BROWSER_UI_TOOLS.has(ctx.toolName)) {
      ctx.metadata.set('hosea:instanceId', this.getInstanceId());
    }
    // Continue with original args
    return undefined;
  }

  /**
   * After browser tool execution, emit Dynamic UI content if successful.
   */
  async afterExecute(ctx: PluginExecutionContext, result: unknown): Promise<unknown> {
    // Only handle browser tools that should show UI
    if (!BROWSER_UI_TOOLS.has(ctx.toolName)) {
      return result;
    }

    console.log(`[HoseaUIPlugin] afterExecute for ${ctx.toolName}`);

    // Get instance ID from metadata (stored in beforeExecute)
    const instanceId = ctx.metadata.get('hosea:instanceId') as string;
    if (!instanceId) {
      console.warn('[HoseaUIPlugin] No instanceId in metadata');
      return result;
    }

    // Check if the result indicates success
    const typedResult = result as { success?: boolean; url?: string; title?: string };
    if (!typedResult?.success) {
      console.log(`[HoseaUIPlugin] Tool result not successful:`, typedResult);
      return result;
    }

    console.log(`[HoseaUIPlugin] Emitting Dynamic UI for ${instanceId}:`, typedResult.url);

    // Emit Dynamic UI content for browser view
    this.emitDynamicUI(instanceId, {
      type: 'display',
      title: 'Browser',
      elements: [
        {
          type: 'browser',
          id: 'browser-view',
          instanceId,
          showUrlBar: true,
          showNavButtons: true,
          currentUrl: typedResult.url,
          pageTitle: typedResult.title,
          isLoading: false,
        },
      ],
    });

    return result;
  }
}
