// src/usage/lib.ts
//
// Usage widgets — FEATURE public surface (presentational only).
//
// Aggregated into the published package via `src/exportable/index.ts` (@flexprice/ui).
// Exposes ONLY prop-only UI + pure helpers, so the published bundle never drags in the dashboard's
// data layer (axios/auth/router/react-query). "Bring your own data": fetch usage/wallet/cost
// analytics however you like, map it to the widgets' presentational shapes (via the exported
// adapters, or build the shapes yourself), and render.
//
// Containers (dashboard-only, data-connected) live in `./containers/` and are intentionally NOT
// re-exported here — see `AGENTS.md`'s naming rule: `lib.ts` exports component names, never a
// `*Container`.

// Prop-only UI components — usable individually
export { default as UsageQuota } from './components/UsageQuota';
export { default as MetricCards } from './components/MetricCards';
export { default as UsageTrendChart } from './components/UsageTrendChart';
export { default as UsageBreakdown } from './components/UsageBreakdown';

// Presentational types (public contract, decoupled from backend DTOs)
export type { UsageQuotaItem, UsageQuotaProps } from './types';
export type { MetricCardItem, MetricCardsProps } from './types';
export type { UsageTrendPoint, UsageTrendSeries, UsageTrendChartProps } from './types';
export type { UsageBreakdownRow, UsageBreakdownProps } from './types';

// Runtime validation boundary — normalize untrusted (SDK/BYO-data) input into safe presentational shapes.
export { normalizeUsageQuotaItems, normalizeMetricCardItems, normalizeUsageTrendSeries, normalizeUsageBreakdownRows } from './schema';

// Pure DTO → presentational adapters (optional helpers for consumers mapping Flexprice API data)
export {
	adaptUsageQuotaItems,
	adaptMetricCards,
	adaptUsageTrendSeries,
	adaptUsageBreakdownRows,
	filterItemsByFeatureConfig,
	adaptGroupedTrendSeries,
	adaptGroupedBreakdownRows,
} from './adapters';
export type { GroupedMetric, GroupedLabels } from './adapters';
