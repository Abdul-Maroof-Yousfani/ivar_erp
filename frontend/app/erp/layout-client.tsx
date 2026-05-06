"use client";

import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { TitleUpdater } from "@/components/common/title-updater";

export default function ErpLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardLayout>
            <TitleUpdater section="ERP" />
            {children}
        </DashboardLayout>
    );
}
