import {
    LayoutDashboard,
    Bot,
    CandlestickChart,
    BarChart3,
    Workflow,
    Store,
    Settings,
    HelpCircle,
    LogOut,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/navlink';
import logo from '@/assets/images/aviaca.svg';

const mainNav = [
	{
		title: 'Dashboard',
		path: '/',
		icon: LayoutDashboard,
		enabled: true,
	},
	{ title: 'My Bots', path: '/bots', icon: Bot, enabled: false },
	{
		title: 'Trading',
		path: '/trading',
		icon: CandlestickChart,
		enabled: false,
	},
	{
		title: 'Analytics',
		path: '/analytics',
		icon: BarChart3,
		enabled: false,
	},
	{
		title: 'Strategy',
		path: '/strategy',
		icon: Workflow,
		enabled: false,
	},
	{
		title: 'Marketplace',
		path: '/marketplace',
		icon: Store,
		enabled: false,
	},
];

const bottomNav = [
	{ title: 'Settings', path: '/settings', icon: Settings },
	{ title: 'Help', path: '/help', icon: HelpCircle },
];

export function AppSidebar() {
	const location = useLocation();
	const { state } = useSidebar();
	const collapsed = state === 'collapsed';

	return (
		<Sidebar collapsible="icon" className="border-r border-border">
			<SidebarHeader className="flex items-center justify-center py-4">
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-lg flex items-center justify-center bg-indigo/15 ring-1 ring-indigo/30">
						<img
							src={logo}
							alt="DexBot Logo"
							className="h-full w-full object-contain"
						/>
					</div>
					{!collapsed && (
						<span className="text-lg font-bold tracking-tight gradient-text">
							Aviaca
						</span>
					)}
				</div>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1">
							{mainNav.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild={item.enabled}
										isActive={
											item.enabled &&
											(location.pathname ===
												item.path ||
												location.pathname.startsWith(
													item.path + '/',
												))
										}
										tooltip={
											item.enabled
												? item.title
												: `${item.title} (Coming Soon)`
										}
										className={
											item.enabled
												? ''
												: 'opacity-40 cursor-not-allowed'
										}
									>
										{item.enabled ? (
											<NavLink
												to={item.path}
												end={item.path === '/'}
											>
												<item.icon className="h-4 w-4" />
												<span>{item.title}</span>
											</NavLink>
										) : (
											<span>
												<item.icon className="h-4 w-4" />
												<span>{item.title}</span>
											</span>
										)}
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					{bottomNav.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								asChild
								isActive={location.pathname === item.path}
								tooltip={item.title}
							>
								<NavLink to={item.path}>
									<item.icon className="h-4 w-4" />
									<span>{item.title}</span>
								</NavLink>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip="Logout"
							className="text-muted-foreground hover:text-destructive"
						>
							<LogOut className="h-4 w-4" />
							<span>Logout</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
