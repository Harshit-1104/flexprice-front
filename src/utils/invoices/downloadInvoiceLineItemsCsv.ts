import type { Invoice, LineItem } from '@/models/Invoice';
import { INVOICE_TYPE } from '@/models/Invoice';
import { formatLineItemPeriod } from '@/utils/common/format_date';
import { getPriceTypeLabel } from '@/utils/common/helper_functions';

function escapeCsvCell(value: string): string {
	if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

function lineItemToRow(item: LineItem, invoiceType: INVOICE_TYPE): string[] {
	const displayName = item.display_name ?? '';
	const priceType = invoiceType === INVOICE_TYPE.SUBSCRIPTION ? (item.price_type ? getPriceTypeLabel(item.price_type) : '') : '';
	const billingPeriod = formatLineItemPeriod(item) ?? '';
	const quantity = item.quantity != null && item.quantity !== '' ? String(item.quantity) : '';
	const amount = String(item.amount ?? 0);
	const currency = item.currency ?? '';

	if (invoiceType === INVOICE_TYPE.SUBSCRIPTION) {
		return [displayName, priceType, billingPeriod, quantity, amount, currency];
	}
	return [displayName, quantity, amount, currency];
}

export function buildInvoiceLineItemsCsv(invoice: Invoice): string {
	const items = (invoice.line_items ?? []).filter((li) => Number(li.amount) > 0);
	const type = invoice.invoice_type as INVOICE_TYPE;
	const isSubscription = type === INVOICE_TYPE.SUBSCRIPTION;

	const headers = isSubscription
		? ['Display name', 'Price type', 'Billing period', 'Quantity', 'Amount', 'Currency']
		: ['Display name', 'Quantity', 'Amount', 'Currency'];

	const rows = items.map((item) => lineItemToRow(item, type).map(escapeCsvCell).join(','));
	return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

function sanitizeFilenamePart(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_|_$/g, '') || 'invoice';
}

/**
 * Builds CSV from invoice line items with amount > 0 and triggers a browser download.
 * @returns number of data rows written (excluding header), or 0 if nothing to export
 */
export function downloadInvoiceLineItemsCsv(invoice: Invoice): number {
	const items = (invoice.line_items ?? []).filter((li) => Number(li.amount) > 0);
	if (items.length === 0) {
		return 0;
	}

	const csv = buildInvoiceLineItemsCsv(invoice);
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const baseName = sanitizeFilenamePart(invoice.invoice_number || invoice.id);
	const a = document.createElement('a');
	a.href = url;
	a.download = `invoice-${baseName}.csv`;
	a.click();
	URL.revokeObjectURL(url);
	return items.length;
}
