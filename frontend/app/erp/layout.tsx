export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { PageTransition } from "@/components/layouts/page-transition";

export default function FinanceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardLayout>
            <PageTransition>
                {children}
            </PageTransition>
        </DashboardLayout>
    );
}
