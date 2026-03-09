import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar.layout';
import { Header } from './header.layout';

interface DashboardLayoutProps {
	children: React.ReactNode;
	title: string;
}

export function DashboardLayout({
	children,
	title,
}: DashboardLayoutProps) {
	return (
		<SidebarProvider defaultOpen={false}>
			<AppSidebar />
			<SidebarInset className="min-w-0 flex flex-col h-svh">
				<Header title={title} />
				<main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-5">
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
