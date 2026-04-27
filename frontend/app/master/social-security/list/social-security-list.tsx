"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { columns, SocialSecurityInstitutionRow } from "./columns";
import { SocialSecurityInstitution, deleteSocialSecurityInstitutions, updateSocialSecurityInstitutions } from "@/lib/actions/social-security";
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

interface SocialSecurityListProps {
  initialInstitutions: SocialSecurityInstitution[];
  newItemId?: string;
}

export function SocialSecurityList({ initialInstitutions, newItemId }: SocialSecurityListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const { hasPermission } = useAuth();
  const [editRows, setEditRows] = useState<{ id: string; code: string; name: string; province?: string; status?: string; contributionRate?: number }[]>([]);
  const showAddAction = hasPermission("master.social-security.create");
  const canBulkEdit = hasPermission("master.social-security.update");
  const canBulkDelete = hasPermission("master.social-security.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/social-security/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteSocialSecurityInstitutions(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = (items: SocialSecurityInstitutionRow[]) => {
    setEditRows(items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      province: item.province || "",
      status: item.status,
      contributionRate: item.contributionRate
    })));
    setBulkEditOpen(true);
  };

  const updateEditRow = (id: string, field: string, value: string) => {
    setEditRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.code.trim() && r.name.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    startTransition(async () => {
      const result = await updateSocialSecurityInstitutions(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: SocialSecurityInstitutionRow[] = initialInstitutions.map((item) => ({ ...item, id: item.id.toString() }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Social Security Institutions</h2>
        <p className="text-muted-foreground">Manage SESSI, PESSE, IESSI and other social security institutions</p>
      </div>

      <DataTable<SocialSecurityInstitutionRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Institution" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[
          { key: "code", label: "Code" },
          { key: "name", label: "Name" },
          { key: "province", label: "Province" },
        ]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="social-security-institution-list"
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Institutions</DialogTitle>
            <DialogDescription>Update {editRows.length} institution(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => (
              <div key={row.id} className="space-y-2 border-b pb-4">
                <p className="font-medium text-sm">Institution {index + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Code *</Label>
                    <Input
                      value={row.code}
                      onChange={(e) => updateEditRow(row.id, "code", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Name *</Label>
                    <Input
                      value={row.name}
                      onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Province</Label>
                    <Input
                      value={row.province || ""}
                      onChange={(e) => updateEditRow(row.id, "province", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Input
                      value={row.status || "active"}
                      onChange={(e) => updateEditRow(row.id, "status", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.contributionRate || 0}
                      onChange={(e) => updateEditRow(row.id, "contributionRate", e.target.value)}
                      disabled={isPending}
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

