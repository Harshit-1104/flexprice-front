import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Chip, Dialog, Tooltip } from '@/components/atoms';
import FlexpriceTable, { ColumnData } from '@/components/molecules/Table';
import { formatDateTimeWithSecondsAndTimezone } from '@/utils/common/format_date';
import { GrantAllowanceState, ENTITLEMENT_GRANT_STATUS, ENTITLEMENT_GRANT_MEASURE } from '@/models/Entitlement';
import { formatGrantPeriod } from '@/utils/entitlement/allowanceLabel';
import { EntitlementBudget } from '@/models/CustomerUsage';

interface Props {
	/** The windows to show: one budget's on a parallel feature, the feature's otherwise. */
	allowances: GrantAllowanceState[];
	/** The rule the windows are cut from, shown above them. */
	config?: Pick<EntitlementBudget, 'grant_quota' | 'grant_duration_value' | 'grant_duration_unit' | 'grant_measure' | 'grant_unlimited'>;
	/** Where the entitlement comes from — a plan, an addon, or the subscription itself. */
	sourceName?: string;
	featureName?: string;
	/** Names the budget when a parallel feature has more than one. */
	budgetName?: string;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	/** Sampled when the row was clicked, so every row here agrees on what "now" is. */
	now: number;
}

const fmt = (v: string | number) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const stamp = (iso: string) =>
	new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** What the row is doing right now. `status` alone cannot say it: a window that has not begun is not active yet. */
type WindowState = 'scheduled' | 'exhausted' | 'active' | 'closed';

const stateOf = (a: GrantAllowanceState, now: number): WindowState => {
	if (new Date(a.valid_from).getTime() > now) return 'scheduled';
	if (a.status === ENTITLEMENT_GRANT_STATUS.EXHAUSTED) return 'exhausted';
	if (a.is_active) return 'active';
	return 'closed';
};

const CHIP_VARIANT: Record<WindowState, 'default' | 'success' | 'failed'> = {
	scheduled: 'default',
	exhausted: 'failed',
	active: 'success',
	closed: 'default',
};

/**
 * Breaks a period total into the grants that produced it. A grant-backed feature
 * bills per grant, so "2,000 used against 1,000" only makes sense once you can
 * see which of them went over and by how much.
 *
 * The whole row is the trigger, so this is a controlled dialog the table owns:
 * one instance for the table rather than one per row.
 */
const GrantWindowLedger: FC<Props> = ({ allowances, config, sourceName, featureName, budgetName, isOpen, onOpenChange, now }) => {
	const { t } = useTranslation('customers');
	// The cadence words ('day', 'billing period') live in the catalog bundle.
	const { t: tCatalog } = useTranslation('catalog');

	const columns: ColumnData<GrantAllowanceState>[] = useMemo(
		() => [
			{
				title: t('usageTable.grantsColumnStart'),
				render: (a) => (
					<Tooltip content={formatDateTimeWithSecondsAndTimezone(a.valid_from)} delayDuration={0} sideOffset={5}>
						<span>{stamp(a.valid_from)}</span>
					</Tooltip>
				),
			},
			{
				title: t('usageTable.grantsColumnEnd'),
				render: (a) => (
					<Tooltip content={formatDateTimeWithSecondsAndTimezone(a.valid_to)} delayDuration={0} sideOffset={5}>
						<span>{stamp(a.valid_to)}</span>
					</Tooltip>
				),
			},
			{
				title: t('usageTable.grantsColumnStatus'),
				render: (a) => {
					const state = stateOf(a, now);
					const chip = <Chip variant={CHIP_VARIANT[state]} label={t(`usageTable.grantState.${state}`)} />;

					// Only exhaustion has something the row does not already show: when it ran out.
					if (state !== 'exhausted' || !a.quota_crossed_at) return chip;
					return (
						<Tooltip
							content={t('usageTable.grantExhaustedAt', { at: formatDateTimeWithSecondsAndTimezone(a.quota_crossed_at) })}
							delayDuration={0}
							sideOffset={5}>
							<span>{chip}</span>
						</Tooltip>
					);
				},
			},
			{
				title: t('usageTable.grantsColumnUsage'),
				align: 'right',
				render: (a) => {
					const usage = Number(a.usage ?? 0);
					const quota = Number(a.quota ?? 0);
					const overage = a.unlimited ? 0 : Math.max(0, usage - quota);
					const cell = (
						<span className={`tabular-nums ${overage > 0 ? 'text-danger' : 'text-content'}`}>
							{fmt(usage)} <span className='text-content-muted'>/ {a.unlimited ? '∞' : fmt(quota)}</span>
						</span>
					);

					if (overage <= 0) return cell;
					return (
						<Tooltip content={t('usageTable.windowOverage', { amount: fmt(overage) })} delayDuration={0} sideOffset={5}>
							{cell}
						</Tooltip>
					);
				},
			},
		],
		[now, t],
	);

	if (!allowances.length) return null;

	const scope = [featureName, budgetName].filter(Boolean).join(' · ');

	const allowanceLabel = config?.grant_unlimited
		? t('usageTable.unlimitedLabel')
		: config?.grant_quota != null
			? tCatalog('entitlements.allowance.perPeriod', {
					amount: fmt(config.grant_quota),
					period: formatGrantPeriod(config, tCatalog),
				})
			: undefined;

	const measureLabel = config?.grant_measure
		? config.grant_measure === ENTITLEMENT_GRANT_MEASURE.AMOUNT
			? t('usageTable.measureAmount')
			: t('usageTable.measureQuantity')
		: undefined;

	const details: { label: string; value: string }[] = [
		...(allowanceLabel ? [{ label: t('usageTable.grantDetailAllowance'), value: allowanceLabel }] : []),
		...(measureLabel ? [{ label: t('usageTable.grantDetailMeasure'), value: measureLabel }] : []),
		...(sourceName ? [{ label: t('usageTable.grantDetailSource'), value: sourceName }] : []),
	];

	return (
		<Dialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={
				<span className='flex items-center gap-1.5'>
					{t('usageTable.grantsTitle')}
					<Tooltip content={t('usageTable.grantsTitleHint')} delayDuration={0} sideOffset={5}>
						<Info className='h-4 w-4 text-content-zinc-subtle transition-colors duration-150 hover:text-content-zinc-tertiary' />
					</Tooltip>
				</span>
			}
			description={scope || undefined}
			className='w-full max-w-2xl'>
			{details.length > 0 && (
				<dl className='mb-4 grid grid-cols-3 gap-4 rounded-md border border-line bg-surface-subtle px-4 py-3'>
					{details.map((d) => (
						<div key={d.label} className='flex flex-col gap-0.5'>
							<dt className='text-xs font-medium text-content-tertiary'>{d.label}</dt>
							<dd className='truncate text-sm text-content'>{d.value}</dd>
						</div>
					))}
				</dl>
			)}

			<div className='overflow-hidden rounded-md border border-line'>
				<FlexpriceTable columns={columns} data={allowances} variant='no-bordered' hideBottomBorder />
			</div>
		</Dialog>
	);
};

export default GrantWindowLedger;
