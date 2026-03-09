import { Bell, Settings, Globe, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
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
		<header className="h-14 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between px-4 gap-4 shrink-0">
			<div className="flex items-center gap-3">
				<SidebarTrigger />

				{/* Animated brand icon */}
				<motion.div
					animate={{
						boxShadow: [
							'0 0 0px oklch(0.76 0.17 60 / 0%)',
							'0 0 14px oklch(0.76 0.17 60 / 50%)',
							'0 0 0px oklch(0.76 0.17 60 / 0%)',
						],
					}}
					transition={{
						duration: 3,
						repeat: Infinity,
						ease: 'easeInOut',
					}}
					className="h-6 w-6 rounded-md bg-indigo/15 flex items-center justify-center"
				>
					<Zap className="h-3.5 w-3.5 text-indigo" />
				</motion.div>

				<h1 className="text-sm font-semibold text-foreground tracking-wide">
					{title}
				</h1>
			</div>

			<div className="flex items-center gap-1.5">
				{/* Language toggle */}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-indigo transition-colors"
					onClick={toggleLanguage}
					title={
						i18n.language?.startsWith('fr')
							? 'Switch to English'
							: 'Passer en Français'
					}
				>
					<Globe className="h-4 w-4" />
				</Button>
				<span className="text-[10px] font-mono text-muted-foreground uppercase w-5 text-center select-none">
					{i18n.language?.startsWith('fr') ? 'FR' : 'EN'}
				</span>

				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-indigo transition-colors"
				>
					<Settings className="h-4 w-4" />
				</Button>

				{/* Notification bell with glow dot */}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-indigo transition-colors relative"
				>
					<Bell className="h-4 w-4" />
					<span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-indigo glow-pulse" />
				</Button>

				{/* Avatar */}
				<div className="flex items-center gap-2 ml-1 px-2 py-1 hover:bg-accent rounded-lg cursor-pointer transition-colors">
					<Avatar className="h-6 w-6">
						<AvatarFallback className="bg-indigo/20 text-indigo text-xs font-semibold">
							CM
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col items-start">
						<span className="text-sm font-medium text-foreground hidden lg:block leading-tight">
							Cameron Mall
						</span>
						<span className="text-[10px] text-muted-foreground hidden lg:block">
							cam12@gmail.com
						</span>
					</div>
				</div>
			</div>
		</header>
	);
}
