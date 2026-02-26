import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/dashboard.page';
import NotFoundPage from './pages/not-found.page';
import { ThemeProvider } from './components/ui/theme-provider';

const queryClient = new QueryClient();

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ReactQueryDevtools initialIsOpen={false} />
			<ThemeProvider
				defaultTheme="system"
				storageKey="vite-ui-theme"
			>
				<TooltipProvider>
					<Toaster />
					<BrowserRouter>
						<Routes>
							<Route path="/" element={<DashboardPage />} />
							<Route path="*" element={<NotFoundPage />} />
						</Routes>
					</BrowserRouter>
				</TooltipProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
