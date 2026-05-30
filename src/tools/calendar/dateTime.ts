/**
 * Calendar date/time normalization shared by provider tools.
 *
 * Provider APIs often split an event time into a wall-clock `dateTime` string
 * and a separate `timeZone` field. Downstream widgets expect an unambiguous
 * UTC ISO string with a `Z` suffix, so provider tools normalize once at the
 * source instead of making every consumer guess.
 */

/**
 * Compute the UTC-offset (in ms) that the given IANA timezone has at the given
 * instant. Positive when the zone is ahead of UTC (for example,
 * Europe/Berlin in CEST is +7_200_000). Uses Intl.DateTimeFormat so it is
 * DST-correct for any date.
 */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  const asUtcMs = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second),
  );
  return asUtcMs - instant.getTime();
}

/**
 * Convert a provider calendar `{ dateTime, timeZone }` pair into an
 * unambiguous UTC ISO 8601 string ending with `Z`.
 *
 * Behavior:
 *   - Empty `dateTime` returns `''`.
 *   - `dateTime` already carries `Z` or a `+/-HH:MM` offset: normalize via
 *     `new Date(...).toISOString()` (preserves the instant, returns Z form).
 *   - Date-only strings (Google all-day events): keep UTC midnight.
 *   - Otherwise: treat `dateTime` as wall-clock time in the given IANA zone
 *     (default `'UTC'`) and shift it to true UTC using the zone's offset at
 *     that instant. Returns UTC ISO with `Z`.
 */
export function calendarDateTimeToUtcIso(
  dateTime: string | undefined,
  timeZone: string | undefined,
): string {
  if (!dateTime) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime)) {
    const d = new Date(`${dateTime}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? dateTime : d.toISOString();
  }
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(dateTime)) {
    const d = new Date(dateTime);
    return Number.isNaN(d.getTime()) ? dateTime : d.toISOString();
  }
  const zone = timeZone && timeZone.length > 0 ? timeZone : 'UTC';
  if (zone === 'UTC') {
    const d = new Date(dateTime + 'Z');
    return Number.isNaN(d.getTime()) ? dateTime : d.toISOString();
  }
  const guess = new Date(dateTime + 'Z');
  if (Number.isNaN(guess.getTime())) return dateTime;
  try {
    const offset = getTimeZoneOffsetMs(guess, zone);
    return new Date(guess.getTime() - offset).toISOString();
  } catch {
    return guess.toISOString();
  }
}

/**
 * Render a UTC instant (the `Z`-form produced by `calendarDateTimeToUtcIso`, or
 * any parseable date string) as human wall-clock time in `displayTimeZone`,
 * e.g. `Thu, May 22, 2026, 2:30 PM EDT`. This is the read-side companion to
 * `calendarDateTimeToUtcIso`: tools keep the canonical UTC value for round-trips
 * and ALSO surface this localized string so the model can state times in the
 * viewer's zone without converting from UTC itself.
 *
 * `allDay` events are anchored to a calendar DATE (stored as UTC midnight), not
 * an instant — zone-converting them would shift the date backward in
 * negative-offset zones (e.g. a May 22 all-day event rendering as "May 21,
 * 8:00 PM"). For those, render the date only, in UTC, so the day is stable and
 * no spurious wall-clock time appears.
 *
 * Returns '' for empty input. On an invalid/missing zone, returns the input
 * unchanged rather than throwing — callers should pass a value only when the
 * host supplied `ToolContext.timeZone`.
 */
export function utcIsoToLocalDisplay(
  iso: string | undefined,
  displayTimeZone: string | undefined,
  allDay = false,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (allDay) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(d);
    } catch {
      return iso.slice(0, 10);
    }
  }
  if (!displayTimeZone) return iso;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: displayTimeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}
