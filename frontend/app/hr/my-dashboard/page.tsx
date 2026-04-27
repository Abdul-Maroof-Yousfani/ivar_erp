"use client";

import { EmployeeDashboardContent } from "@/components/dashboard/employee-dashboard-content";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function MyDashboardPage() {
    return (
        <PermissionGuard permissions="hr.dashboard.view">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight text-muted-foreground hidden">My Dashboard</h1>
                </div>
                <EmployeeDashboardContent />
            </div>
        </PermissionGuard>
    );
}
