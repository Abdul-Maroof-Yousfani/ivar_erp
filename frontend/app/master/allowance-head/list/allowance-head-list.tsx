"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, AllowanceHeadRow } from "./columns";
import {
  AllowanceHead,
  deleteAllowanceHeads,
  updateAllowanceHeads,
} from "@/lib/actions/allowance-head";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign } from "lucide-react";

interface AllowanceHeadListProps {
  initialAllowanceHeads: AllowanceHead[];
  newItemId?: string;
}

export function AllowanceHeadList({ initialAllowanceHeads, newItemId }: AllowanceHeadListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{
    id: string;
    name: string;
    calculationType: string;
    amount: string;
    percentage: string;
  }[]>([]);

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/allowance-head/add");
    });
  };

  const showAddAction = hasPermission("allowance-head.create");
  const canBulkEdit = hasPermission("allowance-head.update");
  const canBulkDelete = hasPermission("allowance-head.delete");

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteAllowanceHeads(ids);
      if (result.status) {
        toast.success(result.message || "Allowance heads deleted successfully");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete allowance heads");
      }
    });
  };

  const handleBulkEdit = (items: AllowanceHeadRow[]) => {
    setEditRows(items.map((item) => ({
      id: item.id,
      name: item.name,
      calculationType: item.calculationType || "Amount",
      amount: item.amount?.toString() || "",
      percentage: item.percentage?.toString() || "",
    })));
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: string, value: string) => {
    setEditRows((rows) =>
      rows.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          if (field === "calculationType") {
            if (value === "Amount") {
              updated.percentage = "";
            } else {
              updated.amount = "";
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate required fields
    for (const row of validRows) {
      if (row.calculationType === "Amount" && !row.amount) {
        toast.error(`Amount is required for "${row.name}" when calculation type is Amount`);
        return;
      }
      if (row.calculationType === "Percentage" && !row.percentage) {
        toast.error(`Percentage is required for "${row.name}" when calculation type is Percentage`);
        return;
      }
    }

    const payload = validRows.map((r) => {
      const item: any = {
        id: r.id,
        name: r.name.trim(),
        calculationType: r.calculationType || "Amount",
      };
      if (r.calculationType === "Amount" && r.amount) {
        item.amount = parseFloat(r.amount);
      } else if (r.calculationType === "Percentage" && r.percentage) {
        item.percentage = parseFloat(r.percentage);
      }
      return item;
    });

    startTransition(async () => {
      const result = await updateAllowanceHeads(payload);
      if (result.status) {
        toast.success(result.message || "Allowance heads updated successfully");
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update allowance heads");
      }
    });
  };

  const data: AllowanceHeadRow[] = initialAllowanceHeads.map((item) => ({ ...item, id: item.id.toString() }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Allowance Heads
          </CardTitle>
          <CardDescription>Manage allowance heads for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<AllowanceHeadRow>
            columns={columns}
            data={data}
            actionText={showAddAction ? "Add Allowance Head" : undefined}
            toggleAction={showAddAction ? handleToggle : undefined}
            newItemId={newItemId}
            searchFields={[{ key: "name", label: "Name" }]}
            onMultiDelete={handleMultiDelete}
            onBulkEdit={handleBulkEdit}
            canBulkEdit={canBulkEdit}
            canBulkDelete={canBulkDelete}
            tableId="allowance-head-list"
          />
        </CardContent>
      </Card>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Allowance Heads</DialogTitle>
            <DialogDescription>
              Update {editRows.length} allowance head(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    {index + 1}
                  </div>
                  <Label className="font-semibold">Allowance Head {index + 1}</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={row.name}
                      onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                      disabled={isPending}
                      placeholder="Allowance head name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calculation Type *</Label>
                    <div className="flex items-center h-10 border rounded-md px-3 bg-background">
                      <RadioGroup
                        value={row.calculationType}
                        onValueChange={(value) => updateEditRow(row.id, "calculationType", value)}
                        disabled={isPending}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Amount" id={`bulk-calc-amount-${row.id}`} />
                          <Label htmlFor={`bulk-calc-amount-${row.id}`} className="cursor-pointer font-normal text-sm">
                            Amount
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Percentage" id={`bulk-calc-percentage-${row.id}`} />
                          <Label htmlFor={`bulk-calc-percentage-${row.id}`} className="cursor-pointer font-normal text-sm">
                            Percent
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {row.calculationType === "Amount" ? (
                      <>
                        <Label>Amount *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => updateEditRow(row.id, "amount", e.target.value)}
                          disabled={isPending}
                          placeholder="0.00"
                        />
                      </>
                    ) : (
                      <>
                        <Label>Percentage *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={row.percentage}
                          onChange={(e) => updateEditRow(row.id, "percentage", e.target.value)}
                          disabled={isPending}
                          placeholder="0.00"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkEditOpen(false)}
              disabled={isPending}
            >
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
