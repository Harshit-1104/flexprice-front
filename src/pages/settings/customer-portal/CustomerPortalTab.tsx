import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, Loader } from '@/components/atoms';
import { SettingsCardHeader, SettingsToggleRow } from '@/components/molecules';
import type { PortalConfig, UsagePropertiesConfig } from '@/types/dto/PortalConfig';
import SettingsFormActions from '../SettingsFormActions';
import { applyPortalVisibility, getPortalVisibility, type PortalVisibility } from './portalVisibility';
import { useCustomerPortalConfig } from './useCustomerPortalConfig';
import { useCurrentUserPermissions } from '@/hooks/useCurrentUserPermissions';
import { MeterApi } from '@/api/MeterApi';
import PropertyKeysInput from './PropertyKeysInput';

const KEY_SUGGESTIONS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const CustomerPortalTab = () => {
	const { t } = useTranslation(['settings', 'common']);
	const { config, isLoading, updateConfig } = useCustomerPortalConfig();
	const { can, isSuperAdmin } = useCurrentUserPermissions();
	// Backed by SettingsApi (a generic settings key), whose PUT/DELETE the backend restricts
	// to Super Admin regardless of portal:write — see SamlSsoTab's own settings-gating note.
	const canWritePortal = can('portal', 'write') && isSuperAdmin;
	const [draftConfig, setDraftConfig] = useState<PortalConfig>(config);

	useEffect(() => {
		setDraftConfig(config);
	}, [config]);

	const visibility = useMemo(() => getPortalVisibility(draftConfig), [draftConfig]);

	const handleToggle = (key: keyof PortalVisibility, checked: boolean) => {
		setDraftConfig((prev) => applyPortalVisibility(prev, { ...getPortalVisibility(prev), [key]: checked }));
	};

	const usageProperties = draftConfig.analytics_config?.usage_properties ?? {};

	const keySuggestions = useQuery({
		queryKey: ['settings', 'usage-property-keys'],
		queryFn: () => {
			const end = new Date();
			return MeterApi.getPropertyKeys({
				start_time: new Date(end.getTime() - KEY_SUGGESTIONS_WINDOW_MS).toISOString(),
				end_time: end.toISOString(),
			});
		},
		enabled: usageProperties.enabled === true,
		staleTime: 5 * 60 * 1000,
	});
	const suggestions = keySuggestions.data?.keys ?? [];

	const updateUsageProperties = (patch: UsagePropertiesConfig) => {
		setDraftConfig((prev) => ({
			...prev,
			analytics_config: {
				...prev.analytics_config,
				usage_properties: { ...prev.analytics_config?.usage_properties, ...patch },
			},
		}));
	};

	const handleReset = () => {
		setDraftConfig(config);
	};

	const handleSave = () => {
		updateConfig.mutate(draftConfig, {
			onSuccess: () => toast.success(t('customerPortal.portal.saveSuccess')),
			onError: () => toast.error(t('customerPortal.portal.saveError')),
		});
	};

	const portalTitle = t('customerPortal.portal.title');

	return (
		<Card variant='default' className='rounded-xl border border-line bg-surface shadow-sm'>
			<SettingsCardHeader
				title={portalTitle}
				titleClassName='text-lg font-medium text-content-zinc-strong'
				infoDescription={t('customerPortal.portal.description')}
				infoAriaLabel={t('info.ariaLabel', { field: portalTitle })}
			/>
			{isLoading ? (
				<div className='flex min-h-[200px] items-center justify-center'>
					<Loader />
				</div>
			) : (
				<>
					<div className='mt-4 divide-y divide-line'>
						<SettingsToggleRow
							label={t('customerPortal.portal.showInvoices')}
							description={t('customerPortal.portal.showInvoicesDescription')}
							infoAriaLabel={t('info.ariaLabel', { field: t('customerPortal.portal.showInvoices') })}
							checked={visibility.showInvoices}
							disabled={updateConfig.isPending}
							onCheckedChange={(checked) => handleToggle('showInvoices', checked)}
						/>
						<SettingsToggleRow
							label={t('customerPortal.portal.showWalletBalance')}
							description={t('customerPortal.portal.showWalletBalanceDescription')}
							infoAriaLabel={t('info.ariaLabel', { field: t('customerPortal.portal.showWalletBalance') })}
							checked={visibility.showWalletBalance}
							disabled={updateConfig.isPending}
							onCheckedChange={(checked) => handleToggle('showWalletBalance', checked)}
						/>
						<SettingsToggleRow
							label={t('customerPortal.portal.showUsage')}
							description={t('customerPortal.portal.showUsageDescription')}
							infoAriaLabel={t('info.ariaLabel', { field: t('customerPortal.portal.showUsage') })}
							checked={visibility.showUsage}
							disabled={updateConfig.isPending}
							onCheckedChange={(checked) => handleToggle('showUsage', checked)}
						/>
						{visibility.showUsage && (
							<div>
								<SettingsToggleRow
									label={t('customerPortal.portal.showUsageProperties')}
									description={t('customerPortal.portal.showUsagePropertiesDescription')}
									infoAriaLabel={t('info.ariaLabel', { field: t('customerPortal.portal.showUsageProperties') })}
									checked={usageProperties.enabled ?? false}
									disabled={updateConfig.isPending}
									onCheckedChange={(checked) => updateUsageProperties({ enabled: checked })}
								/>
								{usageProperties.enabled && (
									<div className='grid gap-6 pb-4 sm:grid-cols-2'>
										<PropertyKeysInput
											label={t('customerPortal.portal.allowedKeys')}
											description={t('customerPortal.portal.allowedKeysDescription')}
											value={usageProperties.allowed_keys ?? []}
											onChange={(keys) => updateUsageProperties({ allowed_keys: keys })}
											suggestions={suggestions}
											isLoading={keySuggestions.isLoading}
											disabled={updateConfig.isPending}
										/>
										<PropertyKeysInput
											label={t('customerPortal.portal.hiddenKeys')}
											description={t('customerPortal.portal.hiddenKeysDescription')}
											value={usageProperties.hidden_keys ?? []}
											onChange={(keys) => updateUsageProperties({ hidden_keys: keys })}
											suggestions={suggestions}
											isLoading={keySuggestions.isLoading}
											disabled={updateConfig.isPending}
										/>
									</div>
								)}
							</div>
						)}
						<SettingsToggleRow
							label={t('customerPortal.portal.showSubscriptions')}
							description={t('customerPortal.portal.showSubscriptionsDescription')}
							infoAriaLabel={t('info.ariaLabel', { field: t('customerPortal.portal.showSubscriptions') })}
							checked={visibility.showSubscriptions}
							disabled={updateConfig.isPending}
							onCheckedChange={(checked) => handleToggle('showSubscriptions', checked)}
						/>
						<SettingsToggleRow
							label={t('customerPortal.portal.showPaymentMethods')}
							description={t('customerPortal.portal.showPaymentMethodsDescription')}
							infoAriaLabel={t('info.ariaLabel', { field: t('customerPortal.portal.showPaymentMethods') })}
							checked={visibility.showPaymentMethods}
							disabled={updateConfig.isPending}
							onCheckedChange={(checked) => handleToggle('showPaymentMethods', checked)}
						/>
					</div>
					<SettingsFormActions
						onReset={handleReset}
						onSave={handleSave}
						isSaving={updateConfig.isPending}
						disabled={isLoading || !canWritePortal}
						disabledReason={canWritePortal ? undefined : t('superAdmin.writeDeniedTooltip')}
					/>
				</>
			)}
		</Card>
	);
};

export default CustomerPortalTab;
