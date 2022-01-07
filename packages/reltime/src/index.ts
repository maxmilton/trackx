// Based on https://github.com/lukeed/fromnow (MIT licence)

const MIN = 60_000; // ms in a minute
const HOUR = MIN * 60;
const DAY = HOUR * 24;
const YEAR = DAY * 365;
const MONTH = DAY * 30;

/**
 * Get a human-readable time relative to a past or future date.
 *
 * @param date - The date from which to calculate the time difference.
 * @param short - Whether to use a short or long form of the time unit.
 * @param maxPeriods - Maximum number of significant periods to keep. E.g., `2`
 * could result in `'1 month, 3 days ago'` and `1` would be `'1 month ago'`.
 */
export default function reltime(
  date: Date | string | number,
  short?: boolean,
  maxPeriods = 1,
): string {
  const del = new Date(date).getTime() - Date.now();
  const abs = Math.abs(del);

  if (abs < MIN) return 'just now';

  const periods = {
    year: abs / YEAR,
    month: (abs % YEAR) / MONTH,
    day: (abs % MONTH) / DAY,
    hour: (abs % DAY) / HOUR,
    minute: (abs % HOUR) / MIN,
  };
  const keep = [];
  let key: keyof typeof periods;

  // eslint-disable-next-line no-restricted-syntax
  for (key in periods) {
    if (keep.length < maxPeriods) {
      const val = Math.floor(periods[key]);

      if (val) {
        // TODO: When short, month and minute both become "m" leading to confusion
        keep.push(
          short ? `${val}${key[0]}` : `${val} ${key}${val === 1 ? '' : 's'}`,
        );
      }
    }
  }

  return keep.join(', ') + (del < 0 ? ' ago' : ' from now');
}
