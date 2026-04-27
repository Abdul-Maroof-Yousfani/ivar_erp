"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, RebateNatureRow } from "./columns";
import {
  RebateNature,
  deleteRebateNature,
} from "@/lib/actions/rebate-nature";
import { toast } from "sonner";

interface RebateNatureListProps {
  initialRebateNatures: RebateNature[];
  newItemId?: string;
}

export function RebateNatureList({
  initialRebateNatures,
  newItemId,
}: RebateNatureListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("rebate-nature.create");
  const canBulkEdit = hasPermission("rebate-nature.update");
  const canBulkDelete = hasPermission("rebate-nature.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/rebate-nature/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      let successCount = 0;
      for (const id of ids) {
        const result = await deleteRebateNature(id);
        if (result.status) successCount++;
      }

      if (successCount > 0) {
        toast.success(`Deleted ${successCount} item${successCount > 1 ? "s" : ""}`);
        router.refresh();
      } else {
        toast.error("Failed to delete items");
      }
    });
  };

  const handleBulkEdit = (items: RebateNatureRow[]) => {
    toast.info("Bulk edit is not available for rebate natures due to complex fields. Please edit items individually.");
  };

  // Transform data to include string id for DataTable
  const data: RebateNatureRow[] = initialRebateNatures.map((item) => ({
    ...item,
    id: item.id.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Rebate Natures</h2>
        <p className="text-muted-foreground">
          Manage tax rebate natures and limits
        </p>
      </div>

      <DataTable<RebateNatureRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add Rebate Nature" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "name", label: "Name" }]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="rebate-nature-list"
      />
    </div>
  );
}
