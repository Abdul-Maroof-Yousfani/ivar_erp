"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { EmployeeDashboardContent } from "@/components/dashboard/employee-dashboard-content";
import { useAuth } from "@/components/providers/auth-provider";

export default function HRPage() {
  const { isAdmin } = useAuth();

  // Show admin dashboard for admin/super_admin
  if (isAdmin()) {
    return <DashboardContent />;
  }

  // Show employee dashboard for regular users
  return (
    <PermissionGuard permissions="hr.dashboard.view">
      <EmployeeDashboardContent />
    </PermissionGuard>
  );
}

