"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns, WorkingHoursPolicyRow } from "./columns";
import {
  WorkingHoursPolicy,
  deleteWorkingHoursPolicy,
} from "@/lib/actions/working-hours-policy";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, FileDown, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";

interface WorkingHoursPolicyListProps {
  initialPolicies: WorkingHoursPolicy[];
  newItemId?: string;
}

export function WorkingHoursPolicyList({
  initialPolicies,
  newItemId,
}: WorkingHoursPolicyListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const handleToggle = () => {
    router.push("/hr/working-hours/create");
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const results = await Promise.all(
        ids.map(id => deleteWorkingHoursPolicy(id))
      );
      const successCount = results.filter(r => r.status).length;
      if (successCount > 0) {
        toast.success(`${successCount} policy(ies) deleted successfully`);
        router.refresh();
      } else {
        toast.error("Failed to delete policies");
      }
    });
  };

  const filteredData = useMemo(() => {
    if (!search) return initialPolicies;
    const searchLower = search.toLowerCase();
    return initialPolicies.filter(
      (policy) =>
        policy.name.toLowerCase().includes(searchLower) ||
        policy.startWorkingHours?.toLowerCase().includes(searchLower) ||
        policy.endWorkingHours?.toLowerCase().includes(searchLower) ||
        policy.lateStartTime?.toLowerCase().includes(searchLower) ||
        policy.halfDayStartTime?.toLowerCase().includes(searchLower) ||
        policy.createdBy?.toLowerCase().includes(searchLower)
    );
  }, [initialPolicies, search]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const tableRows = filteredData.map((policy, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${policy.name}</td>
        <td>${policy.startWorkingHours || "N/A"}</td>
        <td>${policy.endWorkingHours || "N/A"}</td>
        <td>${policy.lateStartTime || "N/A"}</td>
        <td>${policy.halfDayStartTime || "N/A"}</td>
        <td>${policy.createdBy || "N/A"}</td>
        <td>${policy.status || "active"}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Working Hours Policy List</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f4f4f4; }
            h1 { text-align: center; }
          </style>
        </head>
        <body>
          <h1>Working Hours Policy List</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Policy Name</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Late Time</th>
                <th>Half Day Time</th>
                <th>Created By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success("Print preview opened");
  };

  const handleExportCSV = () => {
    const headers = [
      "S.No",
      "Policy Name",
      "Start Time",
      "End Time",
      "Late Time",
      "Half Day Time",
      "Created By",
      "Status",
    ];
    const rows = filteredData.map((policy, index) => [
      index + 1,
      policy.name,
      policy.startWorkingHours || "N/A",
      policy.endWorkingHours || "N/A",
      policy.lateStartTime || "N/A",
      policy.halfDayStartTime || "N/A",
      policy.createdBy || "N/A",
      policy.status || "active",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `working_hours_policies_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("CSV exported successfully");
  };

  // Transform data to include string id for DataTable
  const data: WorkingHoursPolicyRow[] = filteredData.map((policy) => ({
    ...policy,
    id: policy.id.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Working Hours Policies</h2>
        <p className="text-muted-foreground">
          Manage working hours policies for your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <CardTitle className="text-lg">Working Hours Policy List</CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="flex-1 sm:flex-none"
                >
                  <Printer className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="flex-1 sm:flex-none"
                >
                  <FileDown className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                </Button>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<WorkingHoursPolicyRow>
            columns={columns}
            data={data}
            actionText="Add Working Hours Policy"
            toggleAction={hasPermission("hr.working-hour-policy.create") ? handleToggle : undefined}
            newItemId={newItemId}
            searchFields={[
              { key: "name", label: "Policy Name" },
              { key: "startWorkingHours", label: "Start Time" },
              { key: "endWorkingHours", label: "End Time" },
            ]}
            onMultiDelete={hasPermission("hr.working-hour-policy.delete") ? handleMultiDelete : undefined}
            tableId="working-hours-policy-list"
          />
        </CardContent>
      </Card>
    </div>
  );
}

