import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface DashboardTabsProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
}

export function DashboardTabs({
	activeTab,
	onTabChange,
}: DashboardTabsProps) {
	return (
		<Tabs value={activeTab} onValueChange={onTabChange}>
			<TabsList className="bg-secondary border border-border h-9">
				<TabsTrigger
					value="overview"
					className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
				>
					Quick Start Guide
				</TabsTrigger>
				<TabsTrigger
					value="bots"
					className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
				>
					My Bots
					<Badge className="ml-0.5 h-4 px-1 text-[10px] bg-primary/20">
						5
					</Badge>
				</TabsTrigger>
				<TabsTrigger
					value="backtesting"
					className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
				>
					Backtesting
				</TabsTrigger>
				<TabsTrigger
					value="analytics"
					className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
				>
					Analytics
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
