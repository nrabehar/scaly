import { Bell, CalendarDays, Settings, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
	title: string;
}

export function Header({ title }: HeaderProps) {
	const { i18n } = useTranslation();

	const toggleLanguage = () => {
		const next = i18n.language?.startsWith('fr') ? 'en' : 'fr';
		i18n.changeLanguage(next);
	};

	return (
		<header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 gap-4">
			<div className="flex items-center gap-3">
				<SidebarTrigger />
				<h1 className="text-lg font-semibold text-foreground">
					{title}
				</h1>
			</div>

			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-foreground"
					onClick={toggleLanguage}
					title={i18n.language?.startsWith('fr') ? 'Switch to English' : 'Passer en Français'}
				>
					<Globe className="h-4 w-4" />
				</Button>
				<span className="text-[10px] font-mono text-muted-foreground uppercase">
					{i18n.language?.startsWith('fr') ? 'FR' : 'EN'}
				</span>

				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-foreground"
				>
					<CalendarDays className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-foreground"
				>
					<Settings className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
				>
					<Bell className="h-4 w-4" />
					<span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
				</Button>

				<div className="flex items-center gap-2 ml-2 px-2 py-1 hover:bg-accent rounded-lg">
					<Avatar className="h-6 w-6">
						<AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
							CM
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col items-start">
						<span className="text-sm font-medium text-foreground hidden lg:block">
							Cameron Mall
						</span>
						<span className="text-xs text-muted-foreground hidden lg:block">
							cam12@gmail.com
						</span>
					</div>
				</div>
			</div>
		</header>
	);
}
