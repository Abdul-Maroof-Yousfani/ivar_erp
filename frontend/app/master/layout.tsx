export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { MasterTitleUpdater } from "./title-updater";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { PageTransition } from "@/components/layouts/page-transition";

export default function MasterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardLayout>
            <MasterTitleUpdater />
            <PageTransition>
                {children}
            </PageTransition>
        </DashboardLayout>
    );
}
