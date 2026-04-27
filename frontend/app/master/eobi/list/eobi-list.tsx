"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, EOBIRow } from "./columns";
import { EOBI, deleteEOBIs, updateEOBIs } from "@/lib/actions/eobi";
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

interface EOBIListProps {
  initialEOBIs: EOBI[];
  newItemId?: string;
}

export function EOBIList({ initialEOBIs, newItemId }: EOBIListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{ id: string; employerContribution: number; employeeContribution: number; yearMonth: string }[]>([]);
  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("master.eobi.create");
  const canBulkEdit = hasPermission("master.eobi.update");
  const canBulkDelete = hasPermission("master.eobi.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/eobi/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteEOBIs(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: EOBIRow[]) => {
    setEditRows(items.map((item) => ({
      id: item.id,
      employerContribution: item.employerContribution,
      employeeContribution: item.employeeContribution,
      yearMonth: item.yearMonth
    })));
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: string, value: string | number) => {
    setEditRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.yearMonth.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }
    startTransition(async () => {
      const result = await updateEOBIs(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: EOBIRow[] = initialEOBIs.map((e) => ({ ...e, id: e.id.toString() }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">EOBI</h2>
        <p className="text-muted-foreground">Manage EOBI records</p>
      </div>

      <DataTable<EOBIRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add EOBI" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "name", label: "Name" }]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="eobi-list"
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit EOBIs</DialogTitle>
            <DialogDescription>Update {editRows.length} EOBI(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="space-y-2 border-b pb-4">
                <p className="font-medium text-sm">EOBI {index + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Employer Contribution</Label>
                    <Input type="number" value={row.employerContribution} onChange={(e) => updateEditRow(row.id, "employerContribution", parseFloat(e.target.value))} disabled={isPending} />
                  </div>
                  <div>
                    <Label className="text-xs">Employee Contribution</Label>
                    <Input type="number" value={row.employeeContribution} onChange={(e) => updateEditRow(row.id, "employeeContribution", parseFloat(e.target.value))} disabled={isPending} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Year & Month</Label>
                    <Input value={row.yearMonth} onChange={(e) => updateEditRow(row.id, "yearMonth", e.target.value)} disabled={isPending} />
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

