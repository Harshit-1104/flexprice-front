import { useEffect, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronLeft, X } from 'lucide-react';
import CustomerPortalApi from '@/api/CustomerPortalApi';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { portalPropertyValuesQueryKey } from './queryKeys';

const VALUES_SEARCH_DEBOUNCE_MS = 250;
const PROPERTY_LOOKUP_STALE_MS = 5 * 60 * 1000;

export interface UsageFeatureOption {
	id: string;
	name: string;
}

interface UsageToolbarProps {
	startTime: string;
	endTime: string;
	features: UsageFeatureOption[];
	featureIds: string[];
	onFeatureIdsChange: (ids: string[]) => void;
	/** Visible property keys; Group by and Filter are hidden when empty. */
	propertyKeys: string[];
	groupKey: string;
	onGroupKeyChange: (key: string) => void;
	filters: Record<string, string[]>;
	onFiltersChange: (filters: Record<string, string[]>) => void;
}

/** Feature, group-by and property filter controls for the usage section; filters show as removable chips. */
const UsageToolbar = (props: UsageToolbarProps) => {
	const { t } = useTranslation('customer-portal');
	const { propertyKeys, groupKey, filters, onFiltersChange } = props;
	const activeFilters = Object.entries(filters).filter(([, values]) => values.length > 0);

	return (
		<div className='space-y-2'>
			<div className='flex flex-wrap items-center gap-2 [&>*]:max-sm:flex-1'>
				{props.features.length > 1 && (
					<FeaturesPicker features={props.features} featureIds={props.featureIds} onChange={props.onFeatureIdsChange} />
				)}
				{propertyKeys.length > 0 && (
					<>
						<ToolbarPopover
							label={groupKey ? t('usageFilters.groupByKey', { key: groupKey }) : t('usageFilters.groupBy')}
							active={!!groupKey}>
							{(close) => (
								<Command>
									<CommandList>
										<CommandGroup>
											{['', ...propertyKeys].map((key) => (
												<CommandItem
													key={key || '__none__'}
													value={key || '__none__'}
													onSelect={() => {
														props.onGroupKeyChange(key);
														close();
													}}>
													<Check className={cn('me-2 h-4 w-4', key === groupKey ? 'opacity-100' : 'opacity-0')} />
													{key || t('usageFilters.noGrouping')}
												</CommandItem>
											))}
										</CommandGroup>
									</CommandList>
								</Command>
							)}
						</ToolbarPopover>
						<ToolbarPopover
							label={activeFilters.length ? t('usageFilters.filterCount', { count: activeFilters.length }) : t('usageFilters.filter')}
							active={activeFilters.length > 0}>
							{(close) => <FilterPanel {...props} onApply={(next) => (onFiltersChange(next), close())} />}
						</ToolbarPopover>
					</>
				)}
			</div>
			{activeFilters.length > 0 && (
				<div className='flex flex-wrap items-center gap-2'>
					{activeFilters.map(([key, values]) => (
						<span
							key={key}
							className='inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-content'>
							<span className='truncate' title={`${key}: ${values.join(', ')}`}>
								<span className='text-content-secondary'>{key}:</span> {values.slice(0, 2).join(', ')}
								{values.length > 2 && ` +${values.length - 2}`}
							</span>
							<button
								type='button'
								aria-label={t('usageFilters.removeFilter', { key })}
								onClick={() => onFiltersChange(Object.fromEntries(activeFilters.filter(([k]) => k !== key)))}
								className='text-content-secondary hover:text-content'>
								<X className='h-3 w-3' />
							</button>
						</span>
					))}
					<button type='button' onClick={() => onFiltersChange({})} className='text-xs text-content-secondary hover:text-content'>
						{t('usageFilters.clearAll')}
					</button>
				</div>
			)}
		</div>
	);
};

const ToolbarPopover = ({ label, active, children }: { label: string; active: boolean; children: (close: () => void) => ReactNode }) => {
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type='button'
					variant='outline'
					size='sm'
					className={cn('h-9 justify-between gap-1.5 text-xs font-normal', active && 'border-content-secondary text-content')}>
					<span className='truncate'>{label}</span>
					<ChevronDown className='h-3.5 w-3.5 shrink-0 opacity-60' />
				</Button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-[min(20rem,90vw)] p-0'>
				{children(() => setOpen(false))}
			</PopoverContent>
		</Popover>
	);
};

const FeaturesPicker = ({
	features,
	featureIds,
	onChange,
}: {
	features: UsageFeatureOption[];
	featureIds: string[];
	onChange: (ids: string[]) => void;
}) => {
	const { t } = useTranslation('customer-portal');
	const label =
		featureIds.length === 0
			? t('usageFilters.allFeatures')
			: featureIds.length === 1
				? (features.find((f) => f.id === featureIds[0])?.name ?? t('usageFilters.featureCount', { count: 1 }))
				: t('usageFilters.featureCount', { count: featureIds.length });

	return (
		<ToolbarPopover label={label} active={featureIds.length > 0}>
			{() => (
				<Command>
					<CommandInput placeholder={t('usageFilters.searchFeatures')} />
					<CommandList>
						<CommandEmpty>{t('usageFilters.noResults')}</CommandEmpty>
						<CommandGroup>
							{features.map((feature) => {
								const selected = featureIds.includes(feature.id);
								return (
									<CommandItem
										key={feature.id}
										value={`${feature.name} ${feature.id}`}
										onSelect={() => onChange(selected ? featureIds.filter((id) => id !== feature.id) : [...featureIds, feature.id])}>
										<Check className={cn('me-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
										<span className='truncate'>{feature.name}</span>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			)}
		</ToolbarPopover>
	);
};

/** Two steps: pick a key, then tick its values (searched by prefix on the server) and apply. */
const FilterPanel = ({
	startTime,
	endTime,
	featureIds,
	propertyKeys,
	filters,
	onApply,
}: UsageToolbarProps & { onApply: (filters: Record<string, string[]>) => void }) => {
	const { t } = useTranslation('customer-portal');
	const [key, setKey] = useState('');
	const [draft, setDraft] = useState<string[]>([]);
	const [search, setSearch] = useState('');
	const [prefix, setPrefix] = useState('');

	useEffect(() => {
		const timer = setTimeout(() => setPrefix(search.trim()), VALUES_SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [search]);

	const values = useQuery({
		queryKey: portalPropertyValuesQueryKey(startTime, endTime, featureIds, key, prefix),
		queryFn: () =>
			CustomerPortalApi.getPropertyValues({
				start_time: startTime,
				end_time: endTime,
				feature_ids: featureIds.length ? featureIds : undefined,
				key,
				prefix: prefix || undefined,
			}),
		enabled: !!key,
		staleTime: PROPERTY_LOOKUP_STALE_MS,
		placeholderData: keepPreviousData,
	});

	if (!key) {
		return (
			<Command>
				<CommandInput placeholder={t('usageFilters.searchProperties')} />
				<CommandList>
					<CommandEmpty>{t('usageFilters.noResults')}</CommandEmpty>
					<CommandGroup>
						{propertyKeys.map((k) => (
							<CommandItem
								key={k}
								value={k}
								onSelect={() => {
									setKey(k);
									setDraft(filters[k] ?? []);
								}}>
								<span className='flex-1 truncate'>{k}</span>
								{filters[k]?.length ? <span className='text-xs text-content-secondary'>{filters[k].length}</span> : null}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
		);
	}

	// Values the customer already ticked stay listed even when the search no longer matches them.
	const listed = [...new Set([...draft, ...(values.data?.values ?? [])])];

	return (
		<Command shouldFilter={false}>
			<div className='flex items-center gap-1 border-b px-2 py-1.5'>
				<button
					type='button'
					aria-label={t('usageFilters.back')}
					onClick={() => setKey('')}
					className='rounded p-1 text-content-secondary hover:text-content'>
					<ChevronLeft className='h-4 w-4' />
				</button>
				<span className='truncate text-xs font-medium text-content'>{key}</span>
			</div>
			<CommandInput placeholder={t('usageFilters.searchValues')} value={search} onValueChange={setSearch} />
			<CommandList>
				<CommandEmpty>{values.isLoading ? t('usageFilters.loading') : t('usageFilters.noValues')}</CommandEmpty>
				{listed.length > 0 && (
					<CommandGroup>
						{listed.map((value) => {
							const selected = draft.includes(value);
							return (
								<CommandItem
									key={value}
									value={value}
									onSelect={() => setDraft(selected ? draft.filter((v) => v !== value) : [...draft, value])}>
									<Check className={cn('me-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
									<span className='truncate'>{value}</span>
								</CommandItem>
							);
						})}
					</CommandGroup>
				)}
			</CommandList>
			<div className='flex justify-end gap-2 border-t p-2'>
				<Button type='button' size='sm' className='h-8 text-xs' onClick={() => onApply({ ...filters, [key]: draft })}>
					{t('usageFilters.apply')}
				</Button>
			</div>
		</Command>
	);
};

export default UsageToolbar;
