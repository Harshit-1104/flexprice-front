import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

// Mirrors the backend's accepted "properties.<key>" names.
const PROPERTY_KEY_PATTERN = /^[A-Za-z0-9_.]+$/;

interface PropertyKeysInputProps {
	label: string;
	description: string;
	value: string[];
	onChange: (keys: string[]) => void;
	suggestions: string[];
	isLoading: boolean;
	disabled?: boolean;
}

/** Chips for the chosen keys, plus a searchable picker that suggests keys seen in usage and accepts typed ones. */
const PropertyKeysInput = ({ label, description, value, onChange, suggestions, isLoading, disabled }: PropertyKeysInputProps) => {
	const { t } = useTranslation('settings');
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');

	const options = suggestions.filter((key) => !value.includes(key));
	const typed = search.trim();
	const canAddTyped = typed !== '' && PROPERTY_KEY_PATTERN.test(typed) && !value.includes(typed) && !suggestions.includes(typed);

	const add = (key: string) => {
		onChange([...value, key]);
		setSearch('');
	};

	return (
		<div className='space-y-2'>
			<p className='text-sm font-medium text-content-zinc-bold'>{label}</p>
			<div className='flex flex-wrap items-center gap-2'>
				{value.map((key) => (
					<span
						key={key}
						className='inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs text-content-zinc-bold'>
						{key}
						{!disabled && (
							<button
								type='button'
								aria-label={t('customerPortal.portal.removeKey', { key })}
								onClick={() => onChange(value.filter((k) => k !== key))}
								className='text-content-zinc-tertiary hover:text-content-zinc-bold'>
								<X className='h-3 w-3' />
							</button>
						)}
					</span>
				))}
				<Popover
					open={open}
					onOpenChange={(next) => {
						setOpen(next);
						if (!next) setSearch('');
					}}>
					<PopoverTrigger asChild>
						<Button type='button' variant='outline' size='sm' disabled={disabled} className='h-7 gap-1 px-2 text-xs'>
							<Plus className='h-3 w-3' />
							{t('customerPortal.portal.addKey')}
						</Button>
					</PopoverTrigger>
					<PopoverContent align='start' className='w-[min(18rem,90vw)] p-0'>
						<Command>
							<CommandInput placeholder={t('customerPortal.portal.searchKeys')} value={search} onValueChange={setSearch} />
							<CommandList>
								<CommandEmpty>
									{typed && !PROPERTY_KEY_PATTERN.test(typed)
										? t('customerPortal.portal.invalidKeys')
										: isLoading
											? t('customerPortal.portal.loadingKeys')
											: t('customerPortal.portal.noKeysFound')}
								</CommandEmpty>
								{canAddTyped && (
									<CommandGroup>
										<CommandItem value={typed} onSelect={() => add(typed)}>
											{t('customerPortal.portal.addTypedKey', { key: typed })}
										</CommandItem>
									</CommandGroup>
								)}
								{options.length > 0 && (
									<CommandGroup>
										{options.map((key) => (
											<CommandItem key={key} value={key} onSelect={() => add(key)}>
												{key}
											</CommandItem>
										))}
									</CommandGroup>
								)}
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>
			<p className='text-sm text-muted-foreground'>{description}</p>
		</div>
	);
};

export default PropertyKeysInput;
