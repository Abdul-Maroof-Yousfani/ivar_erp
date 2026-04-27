"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, TaxSlabRow } from "./columns";
import { TaxSlab, deleteTaxSlabs, updateTaxSlabs } from "@/lib/actions/tax-slab";
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

interface TaxSlabListProps {
  initialTaxSlabs: TaxSlab[];
  newItemId?: string;
}

export function TaxSlabList({ initialTaxSlabs, newItemId }: TaxSlabListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{ id: string; name: string; minAmount: number; maxAmount: number; rate: number }[]>([]);
  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("master.tax-slab.create");
  const canBulkEdit = hasPermission("master.tax-slab.update");
  const canBulkDelete = hasPermission("master.tax-slab.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/tax-slabs/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteTaxSlabs(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: TaxSlabRow[]) => {
    setEditRows(items.map((item) => ({ id: item.id, name: item.name, minAmount: item.minAmount, maxAmount: item.maxAmount, rate: item.rate })));
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: string, value: string | number) => {
    setEditRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }
    startTransition(async () => {
      const result = await updateTaxSlabs(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: TaxSlabRow[] = initialTaxSlabs.map((ts) => ({ ...ts, id: ts.id.toString() }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tax Slabs</h2>
        <p className="text-muted-foreground">Manage tax slabs for your organization</p>
      </div>

      <DataTable<TaxSlabRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Tax Slab" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "name", label: "Name" }]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="tax-slab-list"
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tax Slabs</DialogTitle>
            <DialogDescription>Update {editRows.length} tax slab(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="space-y-2 border-b pb-4">
                <p className="font-medium text-sm">Tax Slab {index + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={row.name} onChange={(e) => updateEditRow(row.id, "name", e.target.value)} disabled={isPending} />
                  </div>
                  <div>
                    <Label className="text-xs">Rate (%)</Label>
                    <Input type="number" step="0.01" value={row.rate} onChange={(e) => updateEditRow(row.id, "rate", parseFloat(e.target.value))} disabled={isPending} />
                  </div>
                  <div>
                    <Label className="text-xs">Min Amount</Label>
                    <Input type="number" value={row.minAmount} onChange={(e) => updateEditRow(row.id, "minAmount", parseFloat(e.target.value))} disabled={isPending} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Amount</Label>
                    <Input type="number" value={row.maxAmount} onChange={(e) => updateEditRow(row.id, "maxAmount", parseFloat(e.target.value))} disabled={isPending} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={isPending}>Cancel</Button>
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

