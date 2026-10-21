/**
 * React Query keys for customer portal.
 * Shared so widgets and pages can deduplicate cache (e.g. CustomerPortal pre-fetch + InvoicesWidget).
 */
export const portalInvoicesQueryKey = ['portal-invoices-tab'] as const;

/** Matches the key the existing wallet widgets already use — do not change in isolation. */
export const portalWalletsQueryKey = ['portal-wallets'] as const;

export const portalPaymentMethodsQueryKey = ['portal-payment-methods'] as const;

export const portalWalletBalanceQueryKey = (walletId?: string) => ['portal-wallet-balance', walletId] as const;

export const portalInvoiceQueryKey = (invoiceId?: string) => ['portal-invoice', invoiceId] as const;

export const portalPropertyKeysQueryKey = (start?: string, end?: string, featureIds?: string[]) =>
	['portal-property-keys', start, end, featureIds] as const;

export const portalPropertyValuesQueryKey = (start?: string, end?: string, featureIds?: string[], key?: string, prefix?: string) =>
	['portal-property-values', start, end, featureIds, key, prefix] as const;

/**
 * Every query root a completed top-up or payment invalidates.
 *
 * A top-up moves the balance, writes a transaction, and creates an invoice —
 * which in turn feeds the account summary ('portal-invoices-all') and the
 * revenue chart ('portal-analytics'). Those last two were left out, so the
 * customer closed the dialog and saw the old totals until a manual reload.
 * Kept in one place because the callers that need it are spread across the
 * top-up form, the invoice payment hook and the checkout-return handler.
 */
export const PORTAL_BALANCE_QUERY_ROOTS = [
	'portal-wallets',
	'portal-wallet-balance',
	'portal-wallet-transactions',
	'portal-invoices-tab',
	'portal-invoices-all',
	'portal-analytics',
] as const;
