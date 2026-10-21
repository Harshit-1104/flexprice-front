//
// Dashboard-only data-fetching wrapper. NOT exported from the package — see `MetricCards`.
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import CustomerPortalApi from '@/api/CustomerPortalApi';
import type { DashboardAnalyticsRequest } from '@/types';
import type { MetricCardsConfig } from '@/types/dto/PortalConfig';
import type { CustomAnalyticItem } from '@/types/dto/Events';
import { adaptMetricCards } from '../adapters';
import MetricCards from '../components/MetricCards';

// show_cost_metrics is off by default: it renders Cost, Margin and Margin %,
// which are the tenant's cost to serve and their profit on this customer. Those
// are not the customer's numbers to see, so a portal must opt in deliberately
// rather than leak them by omission.
const DEFAULT_CONFIG: MetricCardsConfig = { show_custom_metrics: true, show_revenue_metric: true, show_cost_metrics: false };

interface MetricCardsContainerProps {
	analyticsParams: DashboardAnalyticsRequest;
	config?: MetricCardsConfig;
	className?: string;
}

const MetricCardsContainer = ({ analyticsParams, config, className }: MetricCardsContainerProps) => {
	const { t } = useTranslation('customer-portal');
	const merged: MetricCardsConfig = { ...DEFAULT_CONFIG, ...config };

	const {
		data: analyticsData,
		isLoading: analyticsLoading,
		isError: analyticsError,
	} = useQuery({
		queryKey: ['portal-analytics', analyticsParams],
		queryFn: () => CustomerPortalApi.getAnalytics(analyticsParams),
		enabled: merged.show_custom_metrics,
	});

	const {
		data: costData,
		isLoading: costLoading,
		isError: costError,
	} = useQuery({
		// Include feature_ids so this cache entry (and the request) reflects the same dashboard
		// scope as the custom-metrics query below — otherwise revenue/cost/margin cards would
		// silently include every feature while custom-metric cards stayed scoped.
		queryKey: [
			'portal-cost-analytics',
			analyticsParams.start_time,
			analyticsParams.end_time,
			analyticsParams.feature_ids,
			analyticsParams.property_filters,
		],
		queryFn: () =>
			CustomerPortalApi.getCostAnalytics({
				start_time: analyticsParams.start_time,
				end_time: analyticsParams.end_time,
				feature_ids: analyticsParams.feature_ids,
				property_filters: analyticsParams.property_filters,
				expand: ['meter', 'price'],
			}),
		enabled: merged.show_revenue_metric || merged.show_cost_metrics,
	});

	useEffect(() => {
		if (analyticsError) toast.error(t('errors.loadAnalytics'));
	}, [analyticsError, t]);
	useEffect(() => {
		if (costError) toast.error(t('errors.loadCostAnalytics'));
	}, [costError, t]);

	const customItems: CustomAnalyticItem[] = analyticsData?.custom_analytics ?? [];
	const isLoading =
		(merged.show_custom_metrics && analyticsLoading) || ((merged.show_revenue_metric || merged.show_cost_metrics) && costLoading);
	const metrics = adaptMetricCards(costData, customItems, merged);

	return <MetricCards metrics={metrics} isLoading={isLoading} className={className} />;
};

export default MetricCardsContainer;
