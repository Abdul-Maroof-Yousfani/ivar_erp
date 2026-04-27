"use client";

import { useRouter } from "next/navigation";
import { useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, type TaxRateRow } from "./columns";
import { type TaxRate, deleteTaxRate } from "@/lib/actions/tax-rate";
import { toast } from "sonner";

interface TaxRateListProps {
  initialItems: TaxRate[];
  newItemId?: string;
}

export function TaxRateList({ initialItems, newItemId }: TaxRateListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/tax-rate/add");
    });
  };

  const showAddAction = hasPermission("master.tax-rate.create");
  const canBulkDelete = hasPermission("master.tax-rate.delete");

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      for (const id of ids) {
        await deleteTaxRate(id);
      }
      toast.success("Tax Rates deleted successfully");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tax Rate 1</h2>
        <p className="text-muted-foreground">Manage Tax Rate 1 values</p>
      </div>

      <DataTable<TaxRateRow>
        columns={columns}
        data={initialItems}
        actionText={showAddAction ? "Add Tax Rate 1" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "taxRate1", label: "Tax Rate 1" }]}
        onMultiDelete={handleMultiDelete}
        canBulkDelete={canBulkDelete}
        tableId="tax-rate1-list"
      />
    </div>
  );
}
