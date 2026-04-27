"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, BankRow } from "./columns";
import {
  Bank,
  deleteBanks,
  updateBanks,
} from "@/lib/actions/bank";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";

interface BankListProps {
  initialBanks: Bank[];
  newItemId?: string;
}

export function BankList({ initialBanks, newItemId }: BankListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<{
    id: string;
    name: string;
    code: string;
    accountNumberPrefix: string;
    status: string;
  }[]>([]);

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/banks/add");
    });
  };

  const showAddAction = hasPermission("master.bank.create");
  const canBulkEdit = hasPermission("master.bank.update");
  const canBulkDelete = hasPermission("master.bank.delete");

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteBanks(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: BankRow[]) => {
    setEditRows(items.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code || "",
      accountNumberPrefix: item.accountNumberPrefix || "",
      status: item.status || "active",
    })));
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: string, value: string) => {
    setEditRows((rows) =>
      rows.map((r) => {
        if (r.id === id) {
          return { ...r, [field]: value };
        }
        return r;
      })
    );
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: r.id,
        name: r.name.trim(),
        code: r.code.trim() || undefined,
        accountNumberPrefix: r.accountNumberPrefix.trim() || undefined,
        status: r.status || "active",
      }));

    if (validRows.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await updateBanks(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: BankRow[] = initialBanks.map((item) => ({ ...item, id: item.id.toString() }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Banks
          </CardTitle>
          <CardDescription>Manage banks for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<BankRow>
            columns={columns}
            data={data}
            actionText={showAddAction ? "Add Bank" : undefined}
            toggleAction={showAddAction ? handleToggle : undefined}
            newItemId={newItemId}
            searchFields={[{ key: "name", label: "Name" }]}
            onMultiDelete={handleMultiDelete}
            onBulkEdit={handleBulkEdit}
            canBulkEdit={canBulkEdit}
            canBulkDelete={canBulkDelete}
            tableId="bank-list"
          />
        </CardContent>
      </Card>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Banks</DialogTitle>
            <DialogDescription>Update {editRows.length} bank(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto p-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    {index + 1}
                  </div>
                  <Label className="text-sm font-semibold">Bank {index + 1}</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Bank Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Enter bank name"
                      value={row.name}
                      onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                      disabled={isPending}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Bank Code</Label>
                    <Input
                      placeholder="Enter bank code"
                      value={row.code}
                      onChange={(e) => updateEditRow(row.id, "code", e.target.value)}
                      disabled={isPending}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Account Prefix</Label>
                    <Input
                      placeholder="Enter account prefix"
                      value={row.accountNumberPrefix}
                      onChange={(e) => updateEditRow(row.id, "accountNumberPrefix", e.target.value)}
                      disabled={isPending}
                      className="h-10"
                    />
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

