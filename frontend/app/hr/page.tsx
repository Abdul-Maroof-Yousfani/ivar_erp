"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { EmployeeDashboardContent } from "@/components/dashboard/employee-dashboard-content";
import { useAuth } from "@/components/providers/auth-provider";

export default function HRPage() {
  const router = useRouter();
  const { isAdmin, hasPermission, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAdmin() && !hasPermission("hr.dashboard.view")) {
      if (
        hasPermission("erp.report.pos-available-stock-summary") ||
        hasPermission("erp.report.available-stock-summary")
      ) {
        router.replace("/erp/reports/pos/available-stock-summary");
      }
    }
  }, [loading, isAdmin, hasPermission, router]);

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

