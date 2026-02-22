/**
 * Shared validation for thinking/reasoning configuration across all providers.
 */
export function validateThinkingConfig(
  thinking: { enabled: boolean; budgetTokens?: number; effort?: string }
): void {
  if (!thinking.enabled) return;

  if (thinking.budgetTokens !== undefined) {
    if (typeof thinking.budgetTokens !== 'number' || thinking.budgetTokens < 1) {
      throw new Error(
        `Invalid thinking budgetTokens: ${thinking.budgetTokens}. Must be a positive number.`
      );
    }
  }

  if (thinking.effort !== undefined) {
    const validEfforts = ['low', 'medium', 'high'];
    if (!validEfforts.includes(thinking.effort)) {
      throw new Error(
        `Invalid thinking effort: '${thinking.effort}'. Must be one of: ${validEfforts.join(', ')}`
      );
    }
  }
}
