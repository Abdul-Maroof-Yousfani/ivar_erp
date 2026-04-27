import { Suspense } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TrialBalance5ColClient } from "../trial-balance/trial-balance-5col-client";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function TrialBalance5ColPage() {
  return (
    <PermissionGuard permissions="erp.finance.reports.read">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/erp">ERP</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink href="/erp/finance">Finance</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink href="/erp/finance/reports">Reports</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Trial Balance (5-Column)</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
          <TrialBalance5ColClient />
        </Suspense>
      </div>
    </PermissionGuard>
  );
}
