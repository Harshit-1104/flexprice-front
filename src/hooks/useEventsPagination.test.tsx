import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useEventsPagination, { EVENTS_PAGE_SIZE } from './useEventsPagination';

/**
 * The behaviour under test is the one that made the events list a rate-limit generator: a failed
 * page leaves the sentinel on screen, so the observer re-fires the moment the request settles.
 * Measured against the real UI that was ~60 requests a second, continuing while the user sat
 * still. These cases pin that a failure parks pagination and that a 429 backs off.
 */
const { mockGetRawEvents } = vi.hoisted(() => ({ mockGetRawEvents: vi.fn() }));
vi.mock('@/api/EventsApi', () => ({ default: { getRawEvents: mockGetRawEvents } }));
vi.mock('@/utils/common/Logger', () => ({ logger: { error: vi.fn() } }));

/** Drives the sentinel by hand: `trigger()` is one intersection, as a scroll would produce. */
let triggerIntersection: (() => void) | null = null;
class MockIntersectionObserver {
	private cb: IntersectionObserverCallback;
	constructor(cb: IntersectionObserverCallback) {
		this.cb = cb;
	}
	observe() {
		triggerIntersection = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
	}
	unobserve() {}
	disconnect() {}
	takeRecords() {
		return [];
	}
	root = null;
	rootMargin = '';
	thresholds = [];
}

const page = (n: number, hasMore = true) => ({
	events: Array.from({ length: n }, (_, i) => ({ id: `evt_${i}` })),
	iter_last_key: hasMore ? 'key_next' : undefined,
	has_more: hasMore,
});

const rateLimited = () => Object.assign(new Error('rate limit exceeded'), { status: 429 });

const attachSentinel = (result: { current: { sentinelRef: (n: Element | null) => void } }) => {
	act(() => result.current.sentinelRef(document.createElement('div')));
};

beforeEach(() => {
	vi.clearAllMocks();
	triggerIntersection = null;
	vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('useEventsPagination', () => {
	it('requests 20 rows a page and forwards the scoping params', async () => {
		mockGetRawEvents.mockResolvedValue(page(20));
		const params = { external_customer_id: 'acme', event_name: 'api_call' };
		renderHook(() => useEventsPagination({ params }));

		await waitFor(() => expect(mockGetRawEvents).toHaveBeenCalled());
		expect(EVENTS_PAGE_SIZE).toBe(20);
		expect(mockGetRawEvents).toHaveBeenCalledWith(
			expect.objectContaining({ page_size: 20, external_customer_id: 'acme', event_name: 'api_call' }),
		);
	});

	it('does not fetch until enabled, so a customer-scoped list never queries unscoped', async () => {
		mockGetRawEvents.mockResolvedValue(page(20));
		const { rerender } = renderHook(
			({ on }) => useEventsPagination({ params: { external_customer_id: on ? 'acme' : undefined }, enabled: on }),
			{
				initialProps: { on: false },
			},
		);
		expect(mockGetRawEvents).not.toHaveBeenCalled();

		rerender({ on: true });
		await waitFor(() => expect(mockGetRawEvents).toHaveBeenCalledTimes(1));
		expect(mockGetRawEvents).toHaveBeenCalledWith(expect.objectContaining({ external_customer_id: 'acme' }));
	});

	it('collapses a burst of sentinel hits into one in-flight request', async () => {
		let release: (v: unknown) => void = () => {};
		mockGetRawEvents.mockResolvedValueOnce(page(20)).mockImplementationOnce(() => new Promise((r) => (release = r)));
		const { result } = renderHook(() => useEventsPagination({ params: {} }));
		await waitFor(() => expect(mockGetRawEvents).toHaveBeenCalledTimes(1));
		attachSentinel(result);

		// A fast scroll fires the sentinel repeatedly while the first continuation is still open.
		act(() => {
			triggerIntersection?.();
			triggerIntersection?.();
			triggerIntersection?.();
		});
		expect(mockGetRawEvents).toHaveBeenCalledTimes(2);

		await act(async () => release(page(20, false)));
		expect(mockGetRawEvents).toHaveBeenCalledTimes(2);
	});

	it('parks pagination on a 429 instead of retrying immediately, and says so', async () => {
		vi.useFakeTimers();
		mockGetRawEvents.mockResolvedValueOnce(page(20)).mockRejectedValue(rateLimited());
		const { result } = renderHook(() => useEventsPagination({ params: {} }));
		await act(async () => {
			await Promise.resolve();
		});
		attachSentinel(result);

		await act(async () => {
			triggerIntersection?.();
			await Promise.resolve();
		});
		expect(result.current.isRateLimited).toBe(true);
		expect(result.current.error).toMatch(/rate limit/i);

		// The old code re-fired here within ~15ms. Nothing may go out before the backoff elapses.
		const afterFailure = mockGetRawEvents.mock.calls.length;
		act(() => {
			triggerIntersection?.();
			triggerIntersection?.();
			vi.advanceTimersByTime(1_500);
		});
		expect(mockGetRawEvents).toHaveBeenCalledTimes(afterFailure);

		// ...and it does retry itself once the 2s backoff is up.
		await act(async () => {
			vi.advanceTimersByTime(1_000);
			await Promise.resolve();
		});
		expect(mockGetRawEvents.mock.calls.length).toBeGreaterThan(afterFailure);
	});

	it('parks on an ordinary failure and stays parked until the user retries', async () => {
		mockGetRawEvents.mockResolvedValueOnce(page(20)).mockRejectedValue(new Error('boom'));
		const { result } = renderHook(() => useEventsPagination({ params: {} }));
		await waitFor(() => expect(mockGetRawEvents).toHaveBeenCalledTimes(1));
		attachSentinel(result);

		await act(async () => {
			triggerIntersection?.();
			await Promise.resolve();
		});
		await waitFor(() => expect(result.current.error).toBe('boom'));
		expect(result.current.isRateLimited).toBe(false);

		const parked = mockGetRawEvents.mock.calls.length;
		act(() => triggerIntersection?.());
		expect(mockGetRawEvents).toHaveBeenCalledTimes(parked);

		mockGetRawEvents.mockResolvedValue(page(20, false));
		await act(async () => result.current.retry());
		await waitFor(() => expect(result.current.error).toBeNull());
	});

	it('stops requesting once the server says there is nothing more', async () => {
		mockGetRawEvents.mockResolvedValue(page(20, false));
		const { result } = renderHook(() => useEventsPagination({ params: {} }));
		await waitFor(() => expect(result.current.hasMore).toBe(false));
		attachSentinel(result);

		act(() => {
			triggerIntersection?.();
			triggerIntersection?.();
		});
		expect(mockGetRawEvents).toHaveBeenCalledTimes(1);
	});
});
