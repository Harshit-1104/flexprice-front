import { useCallback, useEffect, useRef, useState } from 'react';
import EventsApi from '@/api/EventsApi';
import { Event } from '@/models/Event';
import { GetEventsPayload } from '@/types/dto/Events';
import { getRetryAfterSeconds, isHttpRateLimitError } from '@/core/axios/types';
import { logger } from '@/utils/common/Logger';

/**
 * Rows fetched per page of the events list.
 *
 * Each page costs one request, so the page size sets the request rate of a scroll: at 10 a
 * continuous fast scroll fired a request roughly every 150ms, because a page is consumed about
 * as fast as it arrives. 20 halves that for the same distance travelled, and one 20-row request
 * measured cheaper than the two 10-row requests it replaces. The API caps `page_size` at 50.
 */
export const EVENTS_PAGE_SIZE = 20;

/** Backoff for a rate-limited page, doubling per consecutive 429 up to the cap. */
const RATE_LIMIT_BASE_DELAY_MS = 2_000;
const RATE_LIMIT_MAX_DELAY_MS = 30_000;

export interface UseEventsPaginationOptions {
	/** Query params for every page — filters, and `external_customer_id` where the view is scoped to one customer. */
	params: Partial<GetEventsPayload>;
	/** False while a precondition is still resolving (e.g. the customer whose events these are). */
	enabled?: boolean;
}

export interface UseEventsPaginationResult {
	events: Event[];
	loading: boolean;
	hasMore: boolean;
	/** Set when the last page failed; auto-pagination stays parked until it clears. */
	error: string | null;
	/** True while a rate-limited page is waiting out its backoff and will retry itself. */
	isRateLimited: boolean;
	/** Callback ref for the sentinel element at the end of the list. */
	sentinelRef: (node: Element | null) => void;
	/** Re-fetch from the first page, keeping the current filters. */
	refresh: () => void;
	/** Retry the page that failed, without discarding what is already on screen. */
	retry: () => void;
}

/**
 * Infinite-scroll pagination for the events list.
 *
 * Shared by the tenant-wide events page and the per-customer tab because the failure it guards
 * against is subtle enough that two copies would drift: when a page request fails, the list is
 * not extended, so the sentinel stays on screen and the observer fires again the moment the
 * request settles. With no backoff that is a retry loop — measured at ~60 requests per second,
 * continuing indefinitely while the user sits still — and since a 429 is exactly the response
 * that triggers it, the list's own retries are what keep it rate limited. Auto-pagination
 * therefore parks on any failure and only a backoff timer or an explicit retry restarts it.
 */
export const useEventsPagination = ({ params, enabled = true }: UseEventsPaginationOptions): UseEventsPaginationResult => {
	const [events, setEvents] = useState<Event[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isRateLimited, setIsRateLimited] = useState(false);

	const observer = useRef<IntersectionObserver | null>(null);
	// The sentinel node is held separately from the observer so pagination can be parked and
	// resumed: the callback ref is stable, so React hands us the node once and never again, and
	// an observer disconnected on refresh would otherwise never be re-attached to anything.
	const sentinelNodeRef = useRef<Element | null>(null);
	const requestIdRef = useRef(0);
	// The in-flight guard is a ref, not the `loading` state: the observer callback closes over the
	// render that created it, so a state read there can still be `false` for a request that has
	// already started and would let a duplicate through.
	const inFlightRef = useRef(false);
	const iterLastKeyRef = useRef<string | undefined>(undefined);
	const hasMoreRef = useRef(true);
	const pausedRef = useRef(false);
	const consecutive429Ref = useRef(0);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const paramsRef = useRef(params);
	paramsRef.current = params;
	const paramsKey = JSON.stringify(params ?? {});
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	// fetchPage is declared before connectObserver (which depends on it), so the backoff retry
	// reaches it through a ref rather than a circular callback dependency.
	const connectObserverRef = useRef<(() => void) | null>(null);

	const clearRetryTimer = useCallback(() => {
		if (retryTimerRef.current) {
			clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}
	}, []);

	const fetchPage = useCallback(
		async (iterLastKey?: string) => {
			if (inFlightRef.current) return;
			// Only continuations respect `hasMore`; a first page is always allowed, which is what
			// lets a refresh re-fetch a list that had already been paginated to the end.
			if (iterLastKey && !hasMoreRef.current) return;

			inFlightRef.current = true;
			const requestId = ++requestIdRef.current;
			setLoading(true);
			try {
				const response = await EventsApi.getRawEvents({
					iter_last_key: iterLastKey,
					page_size: EVENTS_PAGE_SIZE,
					...paramsRef.current,
				});

				// A newer request has superseded this one; its result is the current truth.
				if (requestIdRef.current !== requestId) return;

				consecutive429Ref.current = 0;
				pausedRef.current = false;
				setIsRateLimited(false);
				setError(null);

				if (response.events) {
					setEvents((prev) => (iterLastKey ? [...prev, ...response.events] : response.events));
					iterLastKeyRef.current = response.iter_last_key;
					hasMoreRef.current = !!response.has_more;
					setHasMore(!!response.has_more);
				}
			} catch (err) {
				if (requestIdRef.current !== requestId) return;
				logger.error('Error fetching events:', err);

				// Park auto-pagination either way: the sentinel is still on screen because no rows
				// were added, so leaving it armed means retrying immediately and forever.
				pausedRef.current = true;
				observer.current?.disconnect();

				if (isHttpRateLimitError(err)) {
					consecutive429Ref.current += 1;
					setIsRateLimited(true);
					const serverDelayMs = (getRetryAfterSeconds(err) ?? 0) * 1000;
					const backoffMs = Math.min(RATE_LIMIT_BASE_DELAY_MS * 2 ** (consecutive429Ref.current - 1), RATE_LIMIT_MAX_DELAY_MS);
					const delay = Math.max(serverDelayMs, backoffMs);
					setError(err instanceof Error ? err.message : String(err));
					clearRetryTimer();
					retryTimerRef.current = setTimeout(() => {
						retryTimerRef.current = null;
						pausedRef.current = false;
						connectObserverRef.current?.();
						void fetchPage(iterLastKeyRef.current);
					}, delay);
				} else {
					setIsRateLimited(false);
					setError(err instanceof Error ? err.message : String(err));
				}
			} finally {
				inFlightRef.current = false;
				if (requestIdRef.current === requestId) setLoading(false);
			}
		},
		[clearRetryTimer],
	);

	const connectObserver = useCallback(() => {
		observer.current?.disconnect();
		const node = sentinelNodeRef.current;
		if (!node || !enabledRef.current) return;
		observer.current = new IntersectionObserver((entries) => {
			if (!entries[0].isIntersecting) return;
			// Every guard is a ref: the observer callback closes over the render that built it, so
			// a state read here can be stale by the time it fires.
			if (pausedRef.current || inFlightRef.current || !hasMoreRef.current) return;
			void fetchPage(iterLastKeyRef.current);
		});
		observer.current.observe(node);
	}, [fetchPage]);

	connectObserverRef.current = connectObserver;

	const sentinelRef = useCallback(
		(node: Element | null) => {
			sentinelNodeRef.current = node;
			connectObserver();
		},
		[connectObserver],
	);

	/** Start again from the first page. `hard` also clears the rows already on screen. */
	const restart = useCallback(
		(hard: boolean) => {
			clearRetryTimer();
			// Invalidate any in-flight request so its late response cannot overwrite this one's.
			requestIdRef.current += 1;
			inFlightRef.current = false;
			pausedRef.current = false;
			consecutive429Ref.current = 0;
			iterLastKeyRef.current = undefined;
			hasMoreRef.current = true;
			setHasMore(true);
			setError(null);
			setIsRateLimited(false);
			if (hard) setEvents([]);
			// Re-arm the sentinel: it may have been parked by a failure, and the list is about to
			// be short enough for it to come back into view.
			connectObserver();
			void fetchPage(undefined);
		},
		[clearRetryTimer, connectObserver, fetchPage],
	);

	const refresh = useCallback(() => restart(true), [restart]);

	const retry = useCallback(() => {
		clearRetryTimer();
		pausedRef.current = false;
		consecutive429Ref.current = 0;
		setError(null);
		setIsRateLimited(false);
		connectObserver();
		void fetchPage(iterLastKeyRef.current);
	}, [clearRetryTimer, connectObserver, fetchPage]);

	// Re-fetch from the top whenever the filters (or the scoped customer) change.
	//
	// Keyed on the params' *contents*, not their identity: a caller that builds the object inline
	// would otherwise hand us a new reference every render, and since re-fetching sets state, that
	// is an infinite render loop rather than a missed refresh.
	useEffect(() => {
		if (!enabled) return;
		restart(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paramsKey, enabled]);

	useEffect(
		() => () => {
			observer.current?.disconnect();
			if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		},
		[],
	);

	return { events, loading, hasMore, error, isRateLimited, sentinelRef, refresh, retry };
};

export default useEventsPagination;
