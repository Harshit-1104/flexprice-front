import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button, Page } from '@/components/atoms';
import { EventsTable, ApiDocsContent, PropertyFilterQueryBuilder, EventsLoadError } from '@/components/molecules';
import { API_DOCS_TAGS } from '@/constants/apiDocsTags';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { FilterField, FilterFieldType, DataType, FilterOperator, SortOption, SortDirection } from '@/types/common/QueryBuilder';
import useFilterSorting from '@/hooks/useFilterSorting';
import usePagination from '@/hooks/usePagination';
import useEventsPagination from '@/hooks/useEventsPagination';
import { TypedBackendFilter } from '@/types/formatters/QueryBuilder';
import { GetEventsPayload } from '@/types/dto/Events';
import { useTranslation } from 'react-i18next';

// Helper function to convert sanitized filters to Events API parameters
const convertFiltersToEventParams = (filters: TypedBackendFilter[]): Partial<GetEventsPayload> => {
	const params: Partial<GetEventsPayload> = {};

	filters.forEach((filter) => {
		switch (filter.field) {
			case 'event_id':
				if (filter.value.string) {
					params.event_id = filter.value.string;
				}
				break;
			case 'event_name':
				if (filter.value.string) {
					params.event_name = filter.value.string;
				}
				break;
			case 'external_customer_id':
				if (filter.value.string) {
					params.external_customer_id = filter.value.string;
				}
				break;
			case 'start_time':
				if (filter.value.date) {
					params.start_time = filter.value.date;
				}
				break;
			case 'end_time':
				if (filter.value.date) {
					params.end_time = filter.value.date;
				}
				break;
			case 'source':
				if (filter.value.string) {
					params.source = filter.value.string;
				}
				break;
		}
	});

	return params;
};

type PropertyFilterRow = { id: string; key: string; value: string };

/** Encode key/value so ':' and ';' do not break the key:value; serialization format. */
const encodePropertyFilterSegment = (s: string): string => s.replace(/%/g, '%25').replace(/:/g, '%3A').replace(/;/g, '%3B');

const buildPropertyFiltersString = (rows: PropertyFilterRow[]): string | undefined => {
	const pairs = rows
		.filter((r) => (r.key ?? '').trim() && (r.value ?? '').trim())
		.map((r) => {
			const key = (r.key ?? '').trim();
			const value = (r.value ?? '').trim();
			return `${encodePropertyFilterSegment(key)}:${encodePropertyFilterSegment(value)}`;
		});
	if (pairs.length === 0) return undefined;
	return `${pairs.join(';')};`;
};

const createEmptyPropertyFilter = (): PropertyFilterRow => ({
	id: uuidv4(),
	key: '',
	value: '',
});

const EventsPage: React.FC = () => {
	const { t } = useTranslation('developers');
	const { reset } = usePagination();
	const [propertyFilters, setPropertyFilters] = useState<PropertyFilterRow[]>([]);

	const sortingOptions: SortOption[] = useMemo(
		() => [
			{
				field: 'created_at',
				label: t('events.queryBuilder.sort.createdAt'),
				direction: SortDirection.DESC,
			},
			{
				field: 'updated_at',
				label: t('events.queryBuilder.sort.updatedAt'),
				direction: SortDirection.DESC,
			},
		],
		[t],
	);

	const filterOptions: FilterField[] = useMemo(
		() => [
			{
				field: 'event_id',
				label: t('events.queryBuilder.filters.eventId'),
				fieldType: FilterFieldType.INPUT,
				operators: [FilterOperator.EQUAL],
				dataType: DataType.STRING,
			},
			{
				field: 'event_name',
				label: t('events.queryBuilder.filters.eventName'),
				fieldType: FilterFieldType.INPUT,
				operators: [FilterOperator.EQUAL],
				dataType: DataType.STRING,
			},
			{
				field: 'external_customer_id',
				label: t('events.queryBuilder.filters.externalCustomerId'),
				fieldType: FilterFieldType.INPUT,
				operators: [FilterOperator.EQUAL],
				dataType: DataType.STRING,
			},
			{
				field: 'source',
				label: t('events.queryBuilder.filters.source'),
				fieldType: FilterFieldType.INPUT,
				operators: [FilterOperator.EQUAL],
				dataType: DataType.STRING,
			},
			{
				field: 'start_time',
				label: t('events.queryBuilder.filters.startTime'),
				fieldType: FilterFieldType.DATEPICKER,
				operators: [FilterOperator.AFTER],
				dataType: DataType.DATE,
			},
			{
				field: 'end_time',
				label: t('events.queryBuilder.filters.endTime'),
				fieldType: FilterFieldType.DATEPICKER,
				operators: [FilterOperator.BEFORE],
				dataType: DataType.DATE,
			},
		],
		[t],
	);

	const initialFilters = useMemo(() => {
		return [
			{
				field: 'start_time',
				operator: FilterOperator.AFTER,
				valueDate: new Date(new Date().setDate(new Date().getDate() - 30)),
				dataType: DataType.DATE,
				id: 'initial-start-time',
			},
		];
	}, []);

	const initialSorts: SortOption[] = useMemo(
		() => [
			{
				field: 'updated_at',
				label: t('events.queryBuilder.sort.updatedAt'),
				direction: SortDirection.DESC,
			},
		],
		[t],
	);

	const { filters, sorts, setFilters, setSorts, sanitizedFilters, sanitizedSorts } = useFilterSorting({
		initialFilters: initialFilters,
		initialSorts,
		debounceTime: 300,
	});

	// Convert sanitized filters to API parameters - only include parameters that are actually specified
	const apiParams = useMemo(() => {
		const params = convertFiltersToEventParams(sanitizedFilters);
		const propertyFiltersStr = buildPropertyFiltersString(propertyFilters);
		if (propertyFiltersStr) params.property_filters = propertyFiltersStr;
		return params;
	}, [sanitizedFilters, propertyFilters]);

	const { events, loading, hasMore, error, isRateLimited, sentinelRef, refresh, retry } = useEventsPagination({ params: apiParams });

	const resetFilters = () => {
		setFilters(initialFilters);
		setPropertyFilters([]);
	};

	// Reset pagination when filters change
	useEffect(() => {
		reset();
	}, [sanitizedFilters, sanitizedSorts]);

	return (
		<Page heading={t('events.listPage.title')}>
			<ApiDocsContent tags={API_DOCS_TAGS.Events} />
			<div className='bg-surface rounded-md flex items-start gap-4'>
				<PropertyFilterQueryBuilder
					filterOptions={filterOptions}
					filters={filters}
					onFilterChange={setFilters}
					sortOptions={sortingOptions}
					onSortChange={setSorts}
					selectedSorts={sorts}
					debounceTime={300}
					propertyFiltersConfig={{
						rows: propertyFilters,
						setRows: setPropertyFilters,
						createEmpty: createEmptyPropertyFilter,
					}}
					onFilterPopoverReset={resetFilters}
				/>
				<Button variant='outline' onClick={refresh}>
					<RefreshCw />
				</Button>
			</div>
			<div className='bg-surface rounded-md '>
				<EventsTable data={events} />
				<div ref={sentinelRef} />
				{loading && (
					<div className='space-y-4 mt-4'>
						<Skeleton className='h-8 w-full' />
						<Skeleton className='h-8 w-full' />
						<Skeleton className='h-8 w-full' />
					</div>
				)}
				{!loading && error && <EventsLoadError message={error} isRateLimited={isRateLimited} onRetry={retry} />}
				{!hasMore && !error && events.length === 0 && (
					<p className=' text-content-slate-muted text-xs font-normal font-sans mt-4'>{t('events.list.noEventsFound')}</p>
				)}
			</div>
		</Page>
	);
};

export default EventsPage;
