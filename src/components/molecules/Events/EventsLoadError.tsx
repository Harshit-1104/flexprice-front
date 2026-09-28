import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/atoms';
import { AlertTriangle } from 'lucide-react';

interface Props {
	/** Message from the failed request, shown as the secondary line. */
	message: string;
	/** A 429: the list retries itself on a backoff, so the copy says so rather than only offering the button. */
	isRateLimited: boolean;
	onRetry: () => void;
}

/**
 * Shown when a page of the events list fails to load.
 *
 * Auto-pagination parks on failure, so without this the list would simply stop extending with no
 * indication of why — which is how the runaway retry loop stayed invisible: the spinner kept
 * turning and nothing ever said the requests were being rejected.
 */
const EventsLoadError: FC<Props> = ({ message, isRateLimited, onRetry }) => {
	const { t } = useTranslation('developers');

	return (
		<div
			role='alert'
			className='mt-4 flex items-start gap-3 rounded-md border border-border bg-surface-subtle px-4 py-3 text-sm text-content-secondary'>
			<AlertTriangle className='mt-0.5 size-4 shrink-0 text-content-muted' aria-hidden='true' />
			<div className='min-w-0 flex-1'>
				<p className='font-medium text-content'>{isRateLimited ? t('events.list.rateLimitedTitle') : t('events.list.loadFailedTitle')}</p>
				<p className='mt-0.5 break-words text-content-muted'>{isRateLimited ? t('events.list.rateLimitedDescription') : message}</p>
			</div>
			<Button variant='outline' size='sm' className='shrink-0' onClick={onRetry}>
				{t('events.list.retry')}
			</Button>
		</div>
	);
};

export default EventsLoadError;
