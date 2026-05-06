"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import DataTable from "@/components/common/data-table";
import { columns, HolidayRow } from "./columns";
import { Holiday, deleteHolidays, updateHolidays } from "@/lib/actions/holiday";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
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
import { Loader2 } from "lucide-react";

interface HolidayListProps {
  initialHolidays: Holiday[];
  newItemId?: string;
}

export function HolidayList({ initialHolidays, newItemId }: HolidayListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{ id: string; name: string; dateFrom: string; dateTo: string; status: string }[]>([]);

  const handleToggle = () => {
    router.push("/hr/holidays/add");
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteHolidays(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: HolidayRow[]) => {
    setEditRows(
      items.map((item) => ({
        id: item.id,
        name: item.name,
        dateFrom: new Date(item.dateFrom).toISOString().split("T")[0],
        dateTo: new Date(item.dateTo).toISOString().split("T")[0],
        status: item.status,
      }))
    );
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: "name" | "dateFrom" | "dateTo" | "status", value: string) => {
    setEditRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows
      .filter((r) => r.name.trim() && r.dateFrom && r.dateTo)
      .map((r) => ({
        id: r.id,
        name: r.name,
        dateFrom: new Date(r.dateFrom).toISOString(),
        dateTo: new Date(r.dateTo).toISOString(),
        status: r.status,
      }));

    if (validRows.length === 0) {
      toast.error("Please fill in all fields correctly");
      return;
    }

    startTransition(async () => {
      const result = await updateHolidays(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: HolidayRow[] = initialHolidays.map((h) => ({
    ...h,
    id: h.id,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Holidays</h2>
        <p className="text-muted-foreground">Manage holiday configurations</p>
      </div>

      <DataTable<HolidayRow>
        columns={columns}
        data={data}
        actionText="Add Holiday"
        toggleAction={hasPermission("hr.holiday.create") ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "name", label: "Name" }]}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
        onMultiDelete={hasPermission("hr.holiday.delete") ? handleMultiDelete : undefined}
        onBulkEdit={hasPermission("hr.holiday.update") ? handleBulkEdit : undefined}
        tableId="holiday-list"
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Holidays</DialogTitle>
            <DialogDescription>Update {editRows.length} holiday(ies)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="space-y-3 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Holiday Name {index + 1}</Label>
                  <Input
                    value={row.name}
                    onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                    disabled={isPending}
                    className="flex-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={row.dateFrom}
                    onChange={(e) => updateEditRow(row.id, "dateFrom", e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={row.dateTo}
                    onChange={(e) => updateEditRow(row.id, "dateTo", e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={row.status}
                    onChange={(e) => updateEditRow(row.id, "status", e.target.value)}
                    disabled={isPending}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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

