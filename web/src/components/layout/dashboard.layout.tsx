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
			<SidebarInset>
				<Header title={title} />
				<main className="flex-1 overflow-auto p-6">
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
