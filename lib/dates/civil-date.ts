const CIVIL_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Validates a YYYY-MM-DD string as a real calendar date (rejects 2026-02-29 in a
 * non-leap year, day 31 in a 30-day month, month 13, day 0, etc.) without ever
 * returning a Date object or touching the local timezone.
 *
 * `Date.UTC()` is used only as scratch arithmetic: it normalizes out-of-range
 * components (e.g. month 13 rolls into the next year, day 31 of April rolls into May),
 * so re-reading the UTC year/month/day back out and comparing them to what was passed
 * in detects any such overflow. Only UTC getters are used — never `getMonth()`/`getDate()`
 * (the local-timezone variants) — so this can never be skewed by the server's TZ.
 */
export function isValidCivilDate(value: string): boolean {
  const match = CIVIL_DATE_FORMAT.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

/**
 * Formats a YYYY-MM-DD string as DD/MM/AAAA for display. Pure string manipulation, no
 * Date object — parsing the string with `new Date()` and reformatting via
 * `toLocaleDateString()` would risk exactly the timezone-shift bug isValidCivilDate()
 * above is designed to avoid (midnight UTC rendered as the previous day in a negative
 * UTC offset timezone).
 */
export function formatCivilDateBR(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
