/**
 * Customer Portal Configuration Types
 *
 * The portal config is stored in the settings API under key: customer_portal_config
 * It is fetched on portal load and merged with DEFAULT_PORTAL_CONFIG.
 * Any field not set by the tenant falls back to the default.
 */

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * Optional per-tenant theme. When absent the portal uses its default light-mode appearance.
 *
 * CSS variables injected:
 *   --portal-primary  → buttons, active tabs, accent
 *   --portal-bg       → page background
 *   --portal-surface  → card / panel backgrounds
 *   --portal-border   → card and table borders
 */
export interface PortalTheme {
	primary_color: string; // CSS var --portal-primary
	background_color: string; // CSS var --portal-bg
	surface_color: string; // CSS var --portal-surface
	border_color: string; // CSS var --portal-border
	logo_url?: string;
	font_family?: string;
}

// ─── Date Presets ─────────────────────────────────────────────────────────────

export const DatePreset = {
	Today: 'today',
	Last7Days: 'last_7_days',
	Last30Days: 'last_30_days',
	CurrentMonth: 'current_month',
	LastMonth: 'last_month',
} as const;

export type DatePreset = (typeof DatePreset)[keyof typeof DatePreset];

// ─── Widget Types ─────────────────────────────────────────────────────────────

export type TabType =
	| 'subscriptions'
	| 'current_usage'
	| 'usage_graph' // chart only
	| 'usage_breakdown' // table only (shares API cache with usage_graph)
	| 'invoices'
	| 'account_summary' // compact balance / amount due / next billing strip
	| 'wallet_balance'
	| 'wallet_transactions'
	| 'wallet_topup' // top up via hosted checkout
	| 'auto_topup' // auto top-up threshold + amount config
	| 'payment_methods' // saved cards + add a new one
	| 'metric_cards'; // custom + cost metrics in one grid (controlled by MetricCardsConfig)

// ─── Widget-specific Config ───────────────────────────────────────────────────

/**
 * Controls which sub-groups appear inside the metric_cards widget.
 *   show_custom_metrics  → cards from revenue analytics custom_analytics[]
 *   show_revenue_metric  → the customer's total spend, from the cost analytics API
 *   show_cost_metrics    → Cost / Margin / Margin % — the TENANT's cost to serve and
 *                          their profit on this customer. Off by default: these are
 *                          not the customer's numbers to see.
 * If the field is absent in the stored config, all default to true.
 */
export interface MetricCardsConfig {
	show_custom_metrics: boolean;
	show_revenue_metric: boolean;
	show_cost_metrics: boolean;
}

export interface UsageGraphConfig {
	date_presets: DatePreset[];
	default_preset: DatePreset;
	allow_custom_date_range: boolean;
	/** Controls which features appear in the chart */
	feature_filter_mode: 'all' | 'include_list' | 'exclude_list';
	/** feature_ids used when mode is include_list or exclude_list */
	feature_ids?: string[];
}

// ─── Tab (widget instance within a section) ───────────────────────────────────

export interface TabConfig {
	id: string; // unique instance key e.g. "1", "2"
	type: TabType;
	label?: string; // optional display label override (e.g., "Usage Trend" instead of default "Usage")
	enabled: boolean;
	order: number;
	/** Only used when type = "usage_graph" */
	usage_graph?: UsageGraphConfig;
	/** Only used when type = "metric_cards" — controls which sub-groups are shown */
	metric_cards?: MetricCardsConfig;
}

// ─── Section ──────────────────────────────────────────────────────────────────

export interface SectionConfig {
	id: string; // e.g. "overview", "usage", "invoices", "credits"
	label: string; // displayed in the top-level tab bar
	enabled: boolean;
	order: number;
	tabs: TabConfig[]; // widgets inside this section, sorted by order
}

// ─── Analytics Config ─────────────────────────────────────────────────────────

/** Event property keys portal users may group and filter usage by. Off unless enabled; allowed_keys empty = all keys. */
export interface UsagePropertiesConfig {
	enabled?: boolean;
	allowed_keys?: string[];
	hidden_keys?: string[];
}

export interface PortalAnalyticsConfig {
	usage_properties?: UsagePropertiesConfig;
}

// ─── Root Config ──────────────────────────────────────────────────────────────

export interface PortalConfig {
	version: string;
	/** Optional — when absent the portal renders with its default light-mode appearance */
	theme?: PortalTheme;
	sections: SectionConfig[];
	analytics_config?: PortalAnalyticsConfig;
}

// ─── Default Config ───────────────────────────────────────────────────────────

export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
	version: '1.0',
	// No default theme — portals without a tenant theme use hardcoded light-mode styles
	sections: [
		{
			id: 'usage',
			label: 'Usage',
			enabled: true,
			order: 2,
			tabs: [
				{ id: '15', type: 'account_summary', enabled: true, order: 0 },
				{
					id: '1',
					type: 'metric_cards',
					enabled: true,
					order: 1,
					metric_cards: { show_custom_metrics: true, show_revenue_metric: true, show_cost_metrics: false },
				},
				{
					id: '2',
					type: 'usage_graph',
					enabled: true,
					order: 2,
					usage_graph: {
						date_presets: [DatePreset.Today, DatePreset.Last7Days, DatePreset.Last30Days, DatePreset.CurrentMonth, DatePreset.LastMonth],
						default_preset: DatePreset.Last7Days,
						allow_custom_date_range: true,
						feature_filter_mode: 'all',
					},
				},
				{ id: '3', type: 'usage_breakdown', enabled: true, order: 3 },
				{ id: '4', type: 'current_usage', enabled: true, order: 4 },
			],
		},
		{
			id: 'invoices',
			label: 'Invoices',
			enabled: true,
			order: 4,
			tabs: [{ id: '5', type: 'invoices', enabled: true, order: 1 }],
		},
		{
			id: 'credits',
			label: 'Credits',
			enabled: true,
			order: 3,
			tabs: [
				{ id: '6', type: 'wallet_balance', enabled: true, order: 1 },
				{ id: '12', type: 'auto_topup', enabled: true, order: 2 },
				{ id: '7', type: 'wallet_transactions', enabled: true, order: 3 },
			],
		},
		{
			// Saved cards live on Overview, beside the balance they top up and the
			// subscriptions they pay for. A section of its own held one widget and
			// split managing a card from the reason to manage it.
			id: 'payment_methods',
			label: 'Payments',
			enabled: false,
			order: 5,
			tabs: [{ id: '13', type: 'payment_methods', enabled: true, order: 1 }],
		},
		{
			id: 'overview',
			label: 'Overview',
			enabled: true,
			order: 1,
			tabs: [
				{ id: '16', type: 'wallet_balance', enabled: true, order: 1 },
				{ id: '17', type: 'payment_methods', enabled: true, order: 2 },
				{ id: '9', type: 'subscriptions', enabled: true, order: 3 },
			],
		},
	],
};

// ─── Deep Merge Utility ───────────────────────────────────────────────────────

/**
 * Deep merges tenant config on top of defaults.
 * Arrays (sections, tabs) from tenantConfig fully replace defaults if present —
 * this gives tenants full control over ordering and content.
 */
/** Returns true only if a theme object has at least one non-empty string value. */
function hasThemeValues(theme?: Partial<PortalTheme>): boolean {
	if (!theme) return false;
	return Object.values(theme).some((v) => typeof v === 'string' && v.length > 0);
}

/**
 * Tenant content and visibility, product ordering.
 *
 * A tenant's stored config carries the `order` values that were current when they
 * saved it, so a section later promoted in the defaults stays wherever it was —
 * Overview sat last for every tenant with a saved config. Known sections
 * therefore take the default's order, while the tenant keeps label, enabled and
 * tabs. Sections only the tenant has keep their own order, placed after.
 *
 * The trade-off: a tenant who deliberately reordered a known section loses that.
 * Ordering of the standard sections is treated as a product decision; what a
 * tenant shows, hides and names is not.
 */
function mergeSections(defaults: SectionConfig[], tenant?: SectionConfig[]): SectionConfig[] {
	if (!tenant || tenant.length === 0) return defaults;

	const defaultOrder = new Map(defaults.map((section) => [section.id, section.order]));
	const maxDefaultOrder = defaults.reduce((max, section) => Math.max(max, section.order), 0);

	const reordered = tenant.map((section) => ({
		...section,
		order: defaultOrder.get(section.id) ?? maxDefaultOrder + section.order,
	}));

	const known = new Set(tenant.map((section) => section.id));
	const unseen = defaults.filter((section) => !known.has(section.id));

	return [...reordered, ...unseen].sort((a, b) => a.order - b.order);
}

const OVERVIEW_SECTION_ID = 'overview';

/** Sections the product no longer shows, whatever a stored config says. */
const RETIRED_SECTION_IDS = new Set(['payment_methods']);

/**
 * Overview's composition, and which sections exist at all, are product decisions
 * — like the ordering of the standard sections above.
 *
 * Overview is credits, payments and subscriptions: what the customer owes, how
 * they pay it, and what they are signed up to. Payments is therefore no longer a
 * section of its own; it held a single widget, and splitting the card from the
 * balance it tops up made the customer navigate between the two.
 *
 * Applied after the merge because a stored config replaces the default sections
 * and tabs wholesale, so tenants saved before a change never see it. That is how
 * analytics widgets survived in Overview: any of them also renders the section's
 * date filter, so the summary page opened on a chart and a timeline picker
 * duplicating Usage.
 *
 * Retirement is expressed as `enabled: false` rather than deletion, matching how
 * the rest of this file treats a hidden section.
 *
 * The trade-off, and it is a real one: a tenant who curated their own Overview,
 * or who wanted a standalone Payments tab, loses that. Every other section still
 * honours the tenant's tabs, labels and visibility.
 */
function withPortalComposition(sections: SectionConfig[], defaults: SectionConfig[]): SectionConfig[] {
	const defaultOverviewTabs = defaults.find((section) => section.id === OVERVIEW_SECTION_ID)?.tabs;

	return sections.map((section) => {
		if (RETIRED_SECTION_IDS.has(section.id)) return { ...section, enabled: false };
		// Label and enabled stay the tenant's — what they call it and whether they
		// show it at all is still theirs.
		if (section.id === OVERVIEW_SECTION_ID && defaultOverviewTabs) return { ...section, tabs: defaultOverviewTabs };
		return section;
	});
}

export function deepMergePortalConfig(defaults: PortalConfig, tenant: Partial<PortalConfig>): PortalConfig {
	const mergedTheme = { ...(defaults.theme ?? {}), ...(tenant.theme ?? {}) } as PortalTheme;
	return {
		version: tenant.version ?? defaults.version,
		// Only set theme if the merged result actually has at least one value.
		// An empty {} from the backend must NOT override the light-mode defaults.
		theme: hasThemeValues(mergedTheme) ? mergedTheme : undefined,
		// Tenant sections win on order and content — that is their point — but a
		// wholesale replace also hides any section added to the defaults later, so a
		// tenant with a stored config never sees a newly shipped capability. New
		// default sections are therefore appended rather than dropped.
		//
		// The trade-off: a tenant who deliberately removed a section would see it
		// return. Section removal is expressed by `enabled: false`, not by deletion,
		// so that is the narrower reading of intent.
		sections: withPortalComposition(mergeSections(defaults.sections, tenant.sections), defaults.sections),
		// Kept as stored so saving the settings form doesn't drop it.
		analytics_config: tenant.analytics_config,
	};
}
