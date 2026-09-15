import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createInstance } from 'i18next';
import type { i18n as I18nInstance } from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import enBilling from '@/i18n/locales/en/billing.json';
import { Dialog } from '@/components/ui';
import TopupCard from './WalletTopupCard';

const { mockTopupWallet, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
	mockTopupWallet: vi.fn(),
	mockToastError: vi.fn(),
	mockToastSuccess: vi.fn(),
}));

vi.mock('@/api/WalletApi', () => ({
	default: { topupWallet: mockTopupWallet },
}));
vi.mock('react-hot-toast', () => ({ default: { success: mockToastSuccess, error: mockToastError } }));
vi.mock('@/core/services/tanstack/ReactQueryProvider', () => ({ refetchQueries: vi.fn().mockResolvedValue(undefined) }));

let testI18n: I18nInstance;
beforeAll(async () => {
	const instance = createInstance();
	await instance.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		ns: ['billing'],
		defaultNS: 'billing',
		resources: { en: { billing: enBilling } },
		interpolation: { escapeValue: false },
	});
	testI18n = instance;
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider client={new QueryClient()}>
		<I18nextProvider i18n={testI18n}>
			<Dialog open>{children}</Dialog>
		</I18nextProvider>
	</QueryClientProvider>
);

describe('WalletTopupCard retry after a failed top-up', () => {
	it('clears the reference ID (the request idempotency key) after a failed attempt, so a retry does not resend the same key', async () => {
		mockTopupWallet.mockRejectedValueOnce(new Error('A wallet transaction with this idempotency key already exists'));
		mockTopupWallet.mockResolvedValueOnce({ wallet: undefined });

		const user = userEvent.setup();
		render(
			<Wrapper>
				<TopupCard walletId='wallet_1' currency='USD' />
			</Wrapper>,
		);

		await user.click(screen.getByText('Purchased'));
		await user.type(screen.getByPlaceholderText('credits'), '100');
		await user.type(screen.getByPlaceholderText('Enter reference ID'), 'REF-1');

		await user.click(screen.getByRole('button', { name: 'Skip invoice' }));

		await waitFor(() => expect(mockToastError).toHaveBeenCalled());
		expect(mockTopupWallet).toHaveBeenNthCalledWith(1, expect.objectContaining({ idempotency_key: 'REF-1' }));

		// The failed attempt must not leave the same idempotency key sitting in the field --
		// otherwise every retry resubmits it and gets rejected as a duplicate forever.
		await waitFor(() => expect(screen.getByPlaceholderText('Enter reference ID')).toHaveValue(''));

		await user.click(screen.getByRole('button', { name: 'Skip invoice' }));

		await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
		expect(mockTopupWallet).toHaveBeenNthCalledWith(2, expect.objectContaining({ idempotency_key: undefined }));
	});
});
