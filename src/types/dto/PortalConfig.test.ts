import { describe, it, expect } from 'vitest';
import { deepMergePortalConfig, DEFAULT_PORTAL_CONFIG, type PortalConfig } from './PortalConfig';

const tenantConfig: Partial<PortalConfig> = {
	sections: [{ id: 'usage', label: 'Usage', enabled: true, order: 1, tabs: [] }],
};

describe('deepMergePortalConfig', () => {
	// A stored config carries the order values current when it was saved, so a
	// section later promoted in the defaults would otherwise stay where it was.
	it('puts Overview first even when the stored config ordered it last', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [
				{ id: 'usage', label: 'Usage', enabled: true, order: 1, tabs: [] },
				{ id: 'invoices', label: 'Invoices', enabled: true, order: 2, tabs: [] },
				{ id: 'credits', label: 'Credits', enabled: true, order: 3, tabs: [] },
				{ id: 'overview', label: 'Overview', enabled: true, order: 4, tabs: [] },
			],
		});
		expect(merged.sections.map((s) => s.id)).toEqual(['overview', 'usage', 'credits', 'invoices', 'payment_methods']);
	});

	it('keeps the tenant label and enabled flag while reordering', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [{ id: 'usage', label: 'My Usage', enabled: false, order: 9, tabs: [] }],
		});
		const usage = merged.sections.find((s) => s.id === 'usage');
		expect(usage?.label).toBe('My Usage');
		expect(usage?.enabled).toBe(false);
	});

	// A section only the tenant has must survive, placed after the known ones.
	it('keeps a tenant-only section', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [{ id: 'custom', label: 'Custom', enabled: true, order: 1, tabs: [] }],
		});
		expect(merged.sections.map((s) => s.id)).toContain('custom');
	});

	// A stored config used to replace the defaults wholesale, so a tenant who had
	// ever saved one never saw a newly shipped section — the Payments tab was
	// defined but invisible.
	it('appends default sections the tenant has never seen', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, tenantConfig);
		expect(merged.sections.map((s) => s.id)).toContain('payment_methods');
	});

	it('does not duplicate a section the tenant already has', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, tenantConfig);
		expect(merged.sections.filter((s) => s.id === 'usage')).toHaveLength(1);
	});

	// Removal is expressed with enabled:false, which must still be respected.
	it('respects a section the tenant disabled rather than re-adding it', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [{ id: 'payment_methods', label: 'Payments', enabled: false, order: 1, tabs: [] }],
		});
		expect(merged.sections.find((s) => s.id === 'payment_methods')?.enabled).toBe(false);
	});

	// Cost and Margin are the tenant's cost to serve and their profit on this
	// customer. A portal must opt in deliberately rather than leak them by default.
	it('does not enable cost and margin cards by default', () => {
		const metricTabs = DEFAULT_PORTAL_CONFIG.sections.flatMap((section) => section.tabs).filter((tab) => tab.type === 'metric_cards');

		expect(metricTabs.length).toBeGreaterThan(0);
		for (const tab of metricTabs) {
			expect(tab.metric_cards?.show_cost_metrics).toBe(false);
		}
	});

	it('falls back to defaults when the tenant has no sections', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {});
		expect(merged.sections).toEqual(DEFAULT_PORTAL_CONFIG.sections);
	});

	it('keeps the stored analytics config', () => {
		const analytics_config = { usage_properties: { allowed_keys: ['region'], hidden_keys: ['instance_id'] } };
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, { ...tenantConfig, analytics_config });
		expect(merged.analytics_config).toEqual(analytics_config);
	});
});

describe('Overview composition', () => {
	const overviewTabs = (config: PortalConfig) => config.sections.find((section) => section.id === 'overview')?.tabs ?? [];

	// Credits, payments and subscriptions: what the customer owes, how they pay it,
	// and what they are signed up to.
	it('is the shipped composition, whatever the stored config holds', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [
				{
					id: 'overview',
					label: 'Overview',
					enabled: true,
					order: 1,
					tabs: [
						{ id: '14', type: 'account_summary', enabled: true, order: 1 },
						{ id: '20', type: 'usage_graph', enabled: true, order: 2 },
						{ id: '21', type: 'metric_cards', enabled: true, order: 3 },
					],
				},
			],
		});

		expect(overviewTabs(merged).map((tab) => tab.type)).toEqual(['wallet_balance', 'payment_methods', 'subscriptions']);
	});

	// Any analytics tab in Overview also renders the section's date filter, so a
	// stored config from before the split opened the summary on a chart and a
	// timeline picker duplicating the Usage tab.
	it('carries no analytics, so no date filter renders on it', () => {
		const types = overviewTabs(deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {})).map((tab) => tab.type);
		expect(types).not.toContain('usage_graph');
		expect(types).not.toContain('metric_cards');
		expect(types).not.toContain('usage_breakdown');
	});

	// The rule is scoped to Overview — every other section still honours the
	// tenant's own tabs, and Usage is where analytics belong.
	it('leaves other sections to the tenant', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [
				{ id: 'credits', label: 'Credits', enabled: true, order: 3, tabs: [{ id: '6', type: 'wallet_balance', enabled: true, order: 1 }] },
			],
		});

		expect(merged.sections.find((section) => section.id === 'credits')?.tabs.map((tab) => tab.type)).toEqual(['wallet_balance']);
		expect(merged.sections.find((section) => section.id === 'usage')?.tabs.map((tab) => tab.type)).toContain('usage_graph');
	});

	// What a tenant calls the section, and whether they show it at all, is still theirs.
	it('keeps the tenant label and visibility', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [{ id: 'overview', label: 'Home', enabled: false, order: 1, tabs: [] }],
		});

		const overview = merged.sections.find((section) => section.id === 'overview');
		expect(overview?.label).toBe('Home');
		expect(overview?.enabled).toBe(false);
	});
});

describe('retired sections', () => {
	// Saved cards live on Overview now, beside the balance they top up. A section of
	// its own held one widget and split the card from the reason to manage it.
	it('hides Payments even when a stored config enables it', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {
			sections: [
				{
					id: 'payment_methods',
					label: 'Payments',
					enabled: true,
					order: 5,
					tabs: [{ id: '13', type: 'payment_methods', enabled: true, order: 1 }],
				},
			],
		});

		expect(merged.sections.find((section) => section.id === 'payment_methods')?.enabled).toBe(false);
	});

	// It is gone from the tab bar, but the widget it held is still reachable.
	it('keeps payment methods on Overview', () => {
		const merged = deepMergePortalConfig(DEFAULT_PORTAL_CONFIG, {});
		const overview = merged.sections.find((section) => section.id === 'overview');
		expect(overview?.tabs.map((tab) => tab.type)).toContain('payment_methods');
	});

	it('ships disabled by default too', () => {
		expect(DEFAULT_PORTAL_CONFIG.sections.find((section) => section.id === 'payment_methods')?.enabled).toBe(false);
	});
});
