import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { formatCalendarDay, formatLineItemPeriod } from './format_date';

const previousTz = process.env.TZ;

// Pinned west of UTC: that is where reading "YYYY-MM-DD" as a local instant would slip a day back.
beforeAll(() => {
	process.env.TZ = 'America/Los_Angeles';
	expect(new Date('2026-09-01T00:00:00Z').getTimezoneOffset()).toBe(420);
});

afterAll(() => {
	if (previousTz === undefined) {
		delete process.env.TZ;
	} else {
		process.env.TZ = previousTz;
	}
});

describe('formatCalendarDay', () => {
	test('prints the given day without shifting it into the viewer timezone', () => {
		expect(formatCalendarDay('2026-10-01')).toBe('Oct 01, 2026');
	});

	test('reports an unparseable day', () => {
		expect(formatCalendarDay('not-a-day')).toBe('Invalid Date');
	});
});

describe('formatLineItemPeriod', () => {
	test('uses the backend display_dates as-is', () => {
		expect(
			formatLineItemPeriod({
				period_start: '2026-08-31T18:30:00Z',
				period_end: '2026-09-30T18:30:00Z',
				display_dates: { period_start: '2026-09-01', period_end: '2026-09-30' },
			}),
		).toBe('1 Sep 2026 - 30 Sep 2026');
	});

	test('falls back to the timestamps when display_dates is absent', () => {
		expect(formatLineItemPeriod({ period_start: '2026-09-01T12:00:00Z', period_end: '2026-09-30T12:00:00Z' })).toBe(
			'1 Sep 2026 - 30 Sep 2026',
		);
	});

	test('returns undefined without a period', () => {
		expect(formatLineItemPeriod({})).toBeUndefined();
	});
});
