//
// Dashboard-only data-fetching wrapper. NOT exported from the package — see `UsageTrendChart`.
import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import CustomerPortalApi from '@/api/CustomerPortalApi';
import type { DashboardAnalyticsRequest } from '@/types';
import type { UsageGraphConfig } from '@/types/dto/PortalConfig';
import { formatCompactNumber, getCurrencySymbol } from '@/utils';
import { cn } from '@/lib/utils';
import { adaptGroupedTrendSeries, adaptUsageTrendSeries, filterItemsByFeatureConfig } from '../adapters';
import UsageTrendChart from '../components/UsageTrendChart';

/** Groups shown as their own line; the rest are summed into "Other". */
const MAX_GROUPED_SERIES = 8;

interface UsageTrendChartContainerProps {
	config: UsageGraphConfig;
	analyticsParams: DashboardAnalyticsRequest;
	label?: string;
	className?: string;
	periodLabel?: string;
	/** Set when grouped by a property; the grouped chart plots cost. */
	groupKey?: string;
}

const UsageTrendChartContainer = ({ config, analyticsParams, label, className, periodLabel, groupKey }: UsageTrendChartContainerProps) => {
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
		if (isError) toast.error(t('errors.loadUsageAnalytics'));
	}, [isError, t]);

	const items = analyticsData?.items ?? [];
	const series = groupKey
		? adaptGroupedTrendSeries(filterItemsByFeatureConfig(items, config), groupKey, 'cost', MAX_GROUPED_SERIES, {
				none: t('usageFilters.noValue'),
				other: t('usageFilters.other'),
			})
		: adaptUsageTrendSeries(items, config);
	const currency = analyticsData?.currency;
	const valueFormatter =
		groupKey && currency ? (value: number) => `${getCurrencySymbol(currency)}${formatCompactNumber(value)}` : undefined;

	return (
		<UsageTrendChart
			series={series}
			label={label}
			isLoading={isLoading}
			className={cn(className, isPlaceholderData && 'opacity-60 transition-opacity')}
			periodLabel={periodLabel}
			valueFormatter={valueFormatter}
		/>
	);
};

export default UsageTrendChartContainer;
