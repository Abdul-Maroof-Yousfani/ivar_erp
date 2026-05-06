"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import DataTable from "@/components/common/data-table";
import { columns, ExitClearanceRow } from "./columns";
import { ExitClearance, deleteExitClearances } from "@/lib/actions/exit-clearance";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

interface ExitClearanceListProps {
  initialData: ExitClearance[];
  newItemId?: string;
}

export function ExitClearanceList({ initialData, newItemId }: ExitClearanceListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    router.push("/hr/exit-clearance/create");
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteExitClearances(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: ExitClearanceRow[] = initialData.map((item) => ({
    ...item,
    id: item.id.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Exit Clearance</h2>
        <p className="text-muted-foreground">Manage employee exit clearance records</p>
      </div>

      <DataTable<ExitClearanceRow>
        columns={columns}
        data={data}
        actionText="Create Clearance"
        toggleAction={hasPermission("hr.exit-clearance.create") ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[
          { key: "employeeName", label: "Employee Name" },
          { key: "department", label: "Department" },
        ]}
        onMultiDelete={hasPermission("hr.exit-clearance.delete") ? handleMultiDelete : undefined}
        tableId="exit-clearance-list"
      />
    </div>
  );
}

