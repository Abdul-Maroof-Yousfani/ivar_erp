"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, JobTypeRow } from "./columns";
import { JobType, deleteJobTypes, updateJobTypes } from "@/lib/actions/job-type";
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
import { Loader2 } from "lucide-react";

interface JobTypeListProps {
  initialJobTypes: JobType[];
  newItemId?: string;
}

export function JobTypeList({ initialJobTypes, newItemId }: JobTypeListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{ id: string; name: string }[]>([]);
  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("master.job-type.create");
  const canBulkEdit = hasPermission("master.job-type.update");
  const canBulkDelete = hasPermission("master.job-type.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/job-type/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteJobTypes(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: JobTypeRow[]) => {
    setEditRows(items.map((item) => ({ id: item.id, name: item.name })));
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, value: string) => {
    setEditRows((rows) => rows.map((r) => (r.id === id ? { ...r, name: value } : r)));
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }
    startTransition(async () => {
      const result = await updateJobTypes(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: JobTypeRow[] = initialJobTypes.map((jt) => ({
    ...jt,
    id: jt.id.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Job Types</h2>
        <p className="text-muted-foreground">Manage job types for your organization</p>
      </div>

      <DataTable<JobTypeRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Job Type" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "name", label: "Name" }]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="job-type-list"
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Job Types</DialogTitle>
            <DialogDescription>Update {editRows.length} job type(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="flex gap-2">
                <Input
                  placeholder={`Job Type ${index + 1}`}
                  value={row.name}
                  onChange={(e) => updateEditRow(row.id, e.target.value)}
                  disabled={isPending}
                  className="flex-1"
                />
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

