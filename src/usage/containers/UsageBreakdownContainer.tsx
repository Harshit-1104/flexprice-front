//
// Dashboard-only data-fetching wrapper. NOT exported from the package — see `UsageBreakdown`.
// Shares the `['portal-analytics', analyticsParams]` React Query cache entry with
// `UsageTrendChartContainer` — rendering both in the same section costs one API call, not two.
import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import CustomerPortalApi from '@/api/CustomerPortalApi';
import type { DashboardAnalyticsRequest } from '@/types';
import { cn } from '@/lib/utils';
import { adaptGroupedBreakdownRows, adaptUsageBreakdownRows } from '../adapters';
import UsageBreakdown from '../components/UsageBreakdown';

interface UsageBreakdownContainerProps {
	analyticsParams: DashboardAnalyticsRequest;
	label?: string;
	className?: string;
	/** Set when grouped by a property; grouped rows show cost only. */
	groupKey?: string;
}

const UsageBreakdownContainer = ({ analyticsParams, label, className, groupKey }: UsageBreakdownContainerProps) => {
	const { t } = useTranslation('customer-portal');
	const {
		data: analyticsData,
		isLoading,
		isError,
		isPlaceholderData,
	} = useQuery({
		queryKey: ['portal-analytics', analyticsParams],
		queryFn: () => CustomerPortalApi.getAnalytics(analyticsParams),
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		if (isError) toast.error(t('errors.loadUsageBreakdown'));
	}, [isError, t]);

	const items = analyticsData?.items ?? [];
	const rows = groupKey ? adaptGroupedBreakdownRows(items, groupKey, t('usageFilters.noValue')) : adaptUsageBreakdownRows(items);

	return (
		<UsageBreakdown
			rows={rows}
			label={label}
			nameLabel={groupKey}
			showUsage={!groupKey}
			isLoading={isLoading}
			className={cn(className, isPlaceholderData && 'opacity-60 transition-opacity')}
		/>
	);
};

export default UsageBreakdownContainer;
