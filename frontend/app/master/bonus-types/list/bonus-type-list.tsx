"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, BonusTypeRow } from "./columns";
import {
  BonusType,
  deleteBonusTypes,
  updateBonusTypes,
} from "@/lib/actions/bonus-type";
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
import { Loader2, Gift } from "lucide-react";

interface BonusTypeListProps {
  initialBonusTypes: BonusType[];
  newItemId?: string;
}

export function BonusTypeList({ initialBonusTypes, newItemId }: BonusTypeListProps) {
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
      router.push("/master/bonus-types/add");
    });
  };

  const showAddAction = hasPermission("master.bonus-type.create");
  const canBulkEdit = hasPermission("master.bonus-type.update");
  const canBulkDelete = hasPermission("master.bonus-type.delete");

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteBonusTypes(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: BonusTypeRow[]) => {
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
    const validRows = editRows
      .filter((r) => r.name.trim())
      .map((r) => {
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
      })
      .filter((r) => {
        if (r.calculationType === "Amount" && !r.amount) return false;
        if (r.calculationType === "Percentage" && !r.percentage) return false;
        return true;
      });

    if (validRows.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await updateBonusTypes(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: BonusTypeRow[] = initialBonusTypes.map((item) => ({ ...item, id: item.id.toString() }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Bonus Types
          </CardTitle>
          <CardDescription>Manage bonus types for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<BonusTypeRow>
            columns={columns}
            data={data}
            actionText={showAddAction ? "Add Bonus Type" : undefined}
            toggleAction={showAddAction ? handleToggle : undefined}
            newItemId={newItemId}
            searchFields={[{ key: "name", label: "Name" }]}
            onMultiDelete={handleMultiDelete}
            onBulkEdit={handleBulkEdit}
            canBulkEdit={canBulkEdit}
            canBulkDelete={canBulkDelete}
            tableId="bonus-type-list"
          />
        </CardContent>
      </Card>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Bonus Types</DialogTitle>
            <DialogDescription>Update {editRows.length} bonus type(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto p-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    {index + 1}
                  </div>
                  <Label className="text-sm font-semibold">Bonus Type {index + 1}</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Bonus Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Enter bonus type name"
                      value={row.name}
                      onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                      disabled={isPending}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Calculation Type <span className="text-destructive">*</span>
                    </Label>
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
                        <Label className="text-sm font-medium">
                          Amount <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={row.amount}
                          onChange={(e) => updateEditRow(row.id, "amount", e.target.value)}
                          disabled={isPending}
                          required
                          className="h-10"
                        />
                      </>
                    ) : (
                      <>
                        <Label className="text-sm font-medium">
                          Percentage <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0.00"
                          value={row.percentage}
                          onChange={(e) => updateEditRow(row.id, "percentage", e.target.value)}
                          disabled={isPending}
                          required
                          className="h-10"
                        />
                      </>
                    )}
                  </div>
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

