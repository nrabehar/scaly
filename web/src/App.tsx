import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import DashboardPage from './pages/dashboard.page';
import NotFoundPage from './pages/not-found.page';
import { ThemeProvider } from './components/ui/theme-provider';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ReactQueryDevtools initialIsOpen={false} />
			<ThemeProvider
				defaultTheme="dark"
				storageKey="vite-ui-theme"
			>
				<TooltipProvider>
					<Toaster />
					<BrowserRouter>
						<Routes>
							<Route path="/" element={<DashboardPage />} />
							<Route path="/dashboard" element={<Navigate to="/" replace />} />
							<Route path="*" element={<NotFoundPage />} />
						</Routes>
					</BrowserRouter>
				</TooltipProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
