"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, LeavesPolicyRow } from "./columns";
import {
  LeavesPolicy,
  deleteLeavesPolicies,
  updateLeavesPolicies,
} from "@/lib/actions/leaves-policy";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface LeavesPolicyListProps {
  initialPolicies: LeavesPolicy[];
  newItemId?: string;
}

export function LeavesPolicyList({
  initialPolicies,
  newItemId,
}: LeavesPolicyListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{ id: string; name: string; details?: string }[]>([]);
  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("leaves-policy.create");
  const canBulkEdit = hasPermission("leaves-policy.update");
  const canBulkDelete = hasPermission("leaves-policy.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/leaves-policy/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteLeavesPolicies(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: LeavesPolicyRow[]) => {
    setEditRows(
      items.map((item) => ({
        id: item.id,
        name: item.name,
        details: item.details,
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
    const validRows = editRows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }

    startTransition(async () => {
      const result = await updateLeavesPolicies(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: LeavesPolicyRow[] = initialPolicies.map((item) => ({
    ...item,
    id: item.id.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Leaves Policy</h2>
        <p className="text-muted-foreground">
          Manage leave policies for your organization
        </p>
      </div>

      <DataTable<LeavesPolicyRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Leave Policy" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "name", label: "Name" }]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="leaves-policy-list"
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Leave Policies</DialogTitle>
            <DialogDescription>
              Update {editRows.length} leave policy/policies
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="space-y-2 border-b pb-4">
                <p className="font-medium text-sm">Policy {index + 1}</p>
                <div className="space-y-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={row.name}
                    onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Details (Optional)</Label>
                  <Textarea
                    value={row.details || ""}
                    onChange={(e) => updateEditRow(row.id, "details", e.target.value)}
                    disabled={isPending}
                    rows={2}
                  />
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

