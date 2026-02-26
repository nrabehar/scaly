import { DashboardTabs } from '@/components/dashboard/dashboard.tabs';
import { DashboardLayout } from '@/components/layout/dashboard.layout';
import { useState } from 'react';

export default function DashboardPage() {
	const [activeTab, setActiveTab] = useState('overview');

	return (
		<DashboardLayout title="Dashboard">
			<div className="space-y-6">
				<DashboardTabs
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>

				{/* <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Overview</h2>
          <StatCards />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>
          <div className="lg:col-span-2">
            <TradesTable />
          </div>
        </div> */}
			</div>
		</DashboardLayout>
	);
}
