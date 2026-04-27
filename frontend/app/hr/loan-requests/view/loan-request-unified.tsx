"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { List, BarChart3, Plus, Printer, Download } from "lucide-react";
import Link from "next/link";
import DataTable from "@/components/common/data-table";
import { type LoanRequestRow } from "./columns";
import { columns as reportColumns, type LoanReportRow } from "../report/columns";
import { LoanRequestListContent } from "./loan-request-list-content";
import { LoanReportContent } from "./loan-report-content";
import { useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";

interface LoanRequestUnifiedProps {
  listData: LoanRequestRow[];
  reportData: LoanReportRow[];
}

export function LoanRequestUnified({ listData, reportData }: LoanRequestUnifiedProps) {
  const [activeTab, setActiveTab] = useState<"list" | "analytics">("list");
  const { user, isAdmin, hasPermission } = useAuth();

  const canViewReports = isAdmin() || hasPermission("hr.loan-request.read");

  // Calculate summary statistics for analytics
  const summary = useMemo(() => {
    const totalLoans = reportData.length;
    const totalLoanAmount = reportData.reduce((sum, row) => sum + row.loanAmount, 0);
    const totalPaidAmount = reportData.reduce((sum, row) => sum + row.paidAmount, 0);
    const totalRemainingAmount = reportData.reduce((sum, row) => sum + row.remainingAmount, 0);
    const activeLoans = reportData.filter(row => 
      row.status === "Disbursed" || row.status === "Approved"
    ).length;
    const completedLoans = reportData.filter(row => row.status === "Completed").length;
    const pendingLoans = reportData.filter(row => row.status === "Pending").length;
    const overallProgress = totalLoanAmount > 0 
      ? Math.round((totalPaidAmount / totalLoanAmount) * 100) 
      : 0;

    return {
      totalLoans,
      totalLoanAmount,
      totalPaidAmount,
      totalRemainingAmount,
      activeLoans,
      completedLoans,
      pendingLoans,
      overallProgress,
    };
  }, [reportData]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Loan Requests</h2>
          <p className="text-muted-foreground">
            Manage loan requests and track payment analytics
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/hr/loan-requests/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Loan Request
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "list" | "analytics")} className="w-full">
        {canViewReports ? (
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics & Report
            </TabsTrigger>
          </TabsList>
        ) : null}

        {/* List View Tab */}
        <TabsContent value="list" className="mt-6 space-y-6">
          <LoanRequestListContent initialData={listData} canSearch={canViewReports} />
        </TabsContent>

        {/* Analytics & Report Tab */}
        {canViewReports && (
          <TabsContent value="analytics" className="mt-6 space-y-6">
            <LoanReportContent initialData={reportData} summary={summary} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
