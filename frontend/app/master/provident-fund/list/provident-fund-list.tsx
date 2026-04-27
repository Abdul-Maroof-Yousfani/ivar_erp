"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, ProvidentFundRow } from "./columns";
import {
  ProvidentFund,
  deleteProvidentFunds,
  updateProvidentFunds,
} from "@/lib/actions/provident-fund";
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
import { Loader2 } from "lucide-react";

interface ProvidentFundListProps {
  initialProvidentFunds: ProvidentFund[];
  newItemId?: string;
}

export function ProvidentFundList({
  initialProvidentFunds,
  newItemId,
}: ProvidentFundListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{ id: string; name: string; percentage: string }[]>([]);
  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("provident-fund.create");
  const canBulkEdit = hasPermission("provident-fund.update");
  const canBulkDelete = hasPermission("provident-fund.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/provident-fund/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteProvidentFunds(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: ProvidentFundRow[]) => {
    setEditRows(
      items.map((item) => ({
        id: item.id,
        name: item.name,
        percentage: item.percentage.toString(),
      }))
    );
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: string, value: string) => {
    setEditRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.name.trim() && r.percentage.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate percentages
    for (const row of validRows) {
      const percentageValue = parseFloat(row.percentage);
      if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
        toast.error(`Invalid percentage for ${row.name}. Please enter a value between 0-100.`);
        return;
      }
    }

    startTransition(async () => {
      const result = await updateProvidentFunds(
        validRows.map((r) => ({
          id: r.id,
          name: r.name,
          percentage: parseFloat(r.percentage),
        }))
      );
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Transform data to include string id for DataTable
  const data: ProvidentFundRow[] = initialProvidentFunds.map((fund) => ({
    ...fund,
    id: fund.id.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Provident Funds</h2>
        <p className="text-muted-foreground">
          Manage provident funds for your organization
        </p>
      </div>

      <DataTable<ProvidentFundRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Provident Fund" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[
          { key: "name", label: "Name" },
          { key: "percentage", label: "Percentage" },
        ]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="provident-fund-list"
      />

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Provident Funds</DialogTitle>
            <DialogDescription>
              Update {editRows.length} provident fund(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editRows.map((row, index) => (
              <div
                key={row.id}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="font-medium text-sm text-muted-foreground">
                  Provident Fund {index + 1}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="Provident fund name"
                      value={row.name}
                      onChange={(e) =>
                        updateEditRow(row.id, "name", e.target.value)
                      }
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Percentage</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Percentage"
                      value={row.percentage}
                      onChange={(e) =>
                        updateEditRow(row.id, "percentage", e.target.value)
                      }
                      disabled={isPending}
                    />
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

