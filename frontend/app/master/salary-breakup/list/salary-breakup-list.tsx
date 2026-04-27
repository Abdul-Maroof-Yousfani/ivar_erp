"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, SalaryBreakupRow } from "./columns";
import { SalaryBreakup } from "@/lib/actions/salary-breakup";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SalaryBreakupListProps {
  initialSalaryBreakups: SalaryBreakup[];
  newItemId?: string;
}

export function SalaryBreakupList({ initialSalaryBreakups, newItemId }: SalaryBreakupListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{ id: string; salaryType: string; percent: string; isTaxable: boolean }[]>([]);

  // Convert salary breakups to rows (one row per salary breakup)
  const data: SalaryBreakupRow[] = initialSalaryBreakups.map((sb) => {
    const percentage = sb.percentage
      ? (typeof sb.percentage === 'string' ? parseFloat(sb.percentage) : sb.percentage)
      : 0;

    // Parse isTaxable from details field
    let isTaxable = false;
    if (sb.details) {
      try {
        const details = typeof sb.details === 'string' ? JSON.parse(sb.details) : sb.details;
        if (typeof details === 'object' && details !== null && 'isTaxable' in details) {
          isTaxable = Boolean(details.isTaxable);
        }
      } catch (e) {
        // If parsing fails, default to false
        isTaxable = false;
      }
    }

    return {
      id: sb.id,
      salaryType: sb.name,
      percent: percentage,
      isTaxable: isTaxable,
      createdBy: sb.createdBy || "",
      status: sb.status === "active" ? "Active" : "Inactive",
      breakupId: sb.id,
      breakupName: sb.name,
    };
  });

  // Calculate total percentage for active salary breakups
  const totalPercentage = useMemo(() => {
    return data
      .filter((row) => row.status === "Active")
      .reduce((sum, row) => sum + row.percent, 0);
  }, [data]);

  const percentageStatus = useMemo(() => {
    const diff = Math.abs(100 - totalPercentage);
    const roundedTotal = Math.round(totalPercentage * 100) / 100;

    if (roundedTotal === 100) {
      return { status: "valid" as const, message: "Total is exactly 100%", diff: 0 };
    } else if (totalPercentage < 100) {
      return {
        status: "under" as const,
        message: `Total is ${roundedTotal}% (${(100 - roundedTotal).toFixed(2)}% missing)`,
        diff: 100 - roundedTotal
      };
    } else {
      return {
        status: "over" as const,
        message: `Total is ${roundedTotal}% (${(roundedTotal - 100).toFixed(2)}% over)`,
        diff: roundedTotal - 100
      };
    }
  }, [totalPercentage]);

  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("salary-breakup.create");
  const canBulkEdit = hasPermission("salary-breakup.update");
  const canBulkDelete = hasPermission("salary-breakup.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/salary-breakup/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    // TODO: Implement multi-delete when backend endpoint is available
    toast.info("Multi-delete functionality will be available soon");
  };

  const handleBulkEdit = (items: SalaryBreakupRow[]) => {
    setEditRows(
      items.map((item) => ({
        id: item.id,
        salaryType: item.salaryType,
        percent: item.percent.toString(),
        isTaxable: item.isTaxable,
      }))
    );
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: "salaryType" | "percent" | "isTaxable", value: string | boolean) => {
    setEditRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Calculate total percentage for bulk edit
  const bulkEditTotal = useMemo(() => {
    const editedPercentages = editRows
      .filter((r) => r.salaryType.trim() && !isNaN(parseFloat(r.percent)))
      .reduce((sum, r) => sum + parseFloat(r.percent || "0"), 0);

    // Get percentages of items NOT being edited (active items)
    const nonEditedTotal = data
      .filter((row) => row.status === "Active" && !editRows.some((er) => er.id === row.id))
      .reduce((sum, row) => sum + row.percent, 0);

    return editedPercentages + nonEditedTotal;
  }, [editRows, data]);

  const bulkEditStatus = useMemo(() => {
    const roundedTotal = Math.round(bulkEditTotal * 100) / 100;
    if (roundedTotal === 100) {
      return { status: "valid" as const, message: "Total will be exactly 100%", diff: 0 };
    } else if (bulkEditTotal < 100) {
      return {
        status: "under" as const,
        message: `Total will be ${roundedTotal}% (${(100 - roundedTotal).toFixed(2)}% missing)`,
        diff: 100 - roundedTotal
      };
    } else {
      return {
        status: "over" as const,
        message: `Total will be ${roundedTotal}% (${(roundedTotal - 100).toFixed(2)}% over)`,
        diff: roundedTotal - 100
      };
    }
  }, [bulkEditTotal]);

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.salaryType.trim() && !isNaN(parseFloat(r.percent)));
    if (validRows.length === 0) {
      toast.error("Please fill in all fields correctly");
      return;
    }

    // Warn if total is not 100%
    if (bulkEditStatus.status !== "valid") {
      const proceed = window.confirm(
        `Warning: The total percentage will be ${bulkEditTotal.toFixed(2)}%, not 100%. ` +
        `Do you want to proceed anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    // TODO: Implement bulk update when backend endpoint is available
    toast.info("Bulk edit functionality will be available soon");
    setBulkEditOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Salary Breakup</h2>
        <p className="text-muted-foreground">Manage salary breakup configurations</p>
      </div>

      {/* Percentage Total Indicator */}
      <Card className={cn(
        "border-2",
        percentageStatus.status === "valid" && "border-green-500 bg-green-50 dark:bg-green-950/20",
        percentageStatus.status === "under" && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
        percentageStatus.status === "over" && "border-red-500 bg-red-50 dark:bg-red-950/20"
      )}>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {percentageStatus.status === "valid" && (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              )}
              {percentageStatus.status === "under" && (
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              )}
              {percentageStatus.status === "over" && (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  Total Percentage: <span className={cn(
                    "text-lg",
                    percentageStatus.status === "valid" && "text-green-600 dark:text-green-400",
                    percentageStatus.status === "under" && "text-yellow-600 dark:text-yellow-400",
                    percentageStatus.status === "over" && "text-red-600 dark:text-red-400"
                  )}>
                    {totalPercentage.toFixed(2)}%
                  </span>
                </p>
                <p className={cn(
                  "text-sm mt-1",
                  percentageStatus.status === "valid" && "text-green-700 dark:text-green-300",
                  percentageStatus.status === "under" && "text-yellow-700 dark:text-yellow-300",
                  percentageStatus.status === "over" && "text-red-700 dark:text-red-300"
                )}>
                  {percentageStatus.message}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Active Items: {data.filter((row) => row.status === "Active").length}
              </p>
              <p className="text-xs text-muted-foreground">
                Target: 100.00%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable<SalaryBreakupRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Salary Breakup" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[
          { key: "salaryType", label: "Name" },
        ]}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ],
          },
          {
            key: "isTaxable",
            label: "Taxable",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
          },
        ]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="salary-breakup-list"
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Salary Breakup Entries</DialogTitle>
            <DialogDescription>Update {editRows.length} salary breakup entry(ies)</DialogDescription>
          </DialogHeader>

          {/* Bulk Edit Total Indicator */}
          <Alert className={cn(
            "mb-4",
            bulkEditStatus.status === "valid" && "border-green-500 bg-green-50 dark:bg-green-950/20",
            bulkEditStatus.status === "under" && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
            bulkEditStatus.status === "over" && "border-red-500 bg-red-50 dark:bg-red-950/20"
          )}>
            {bulkEditStatus.status === "valid" && (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
            {bulkEditStatus.status === "under" && (
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            )}
            {bulkEditStatus.status === "over" && (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <AlertTitle className={cn(
              "text-sm",
              bulkEditStatus.status === "valid" && "text-green-700 dark:text-green-300",
              bulkEditStatus.status === "under" && "text-yellow-700 dark:text-yellow-300",
              bulkEditStatus.status === "over" && "text-red-700 dark:text-red-300"
            )}>
              Total: {bulkEditTotal.toFixed(2)}%
            </AlertTitle>
            <AlertDescription className={cn(
              "text-xs",
              bulkEditStatus.status === "valid" && "text-green-600 dark:text-green-400",
              bulkEditStatus.status === "under" && "text-yellow-600 dark:text-yellow-400",
              bulkEditStatus.status === "over" && "text-red-600 dark:text-red-400"
            )}>
              {bulkEditStatus.message}
            </AlertDescription>
          </Alert>

          <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="space-y-2 p-3 border rounded-lg">
                <div className="flex gap-2">
                  <Input
                    placeholder={`Salary Type ${index + 1}`}
                    value={row.salaryType}
                    onChange={(e) => updateEditRow(row.id, "salaryType", e.target.value)}
                    disabled={isPending}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Percent"
                    value={row.percent}
                    onChange={(e) => updateEditRow(row.id, "percent", e.target.value)}
                    disabled={isPending}
                    className="w-24"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={row.isTaxable}
                    onCheckedChange={(checked) => updateEditRow(row.id, "isTaxable", !!checked)}
                    disabled={isPending}
                  />
                  <Label className="font-normal text-sm">Taxable</Label>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleBulkEditSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
