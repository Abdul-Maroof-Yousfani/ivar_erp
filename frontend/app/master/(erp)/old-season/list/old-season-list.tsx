"use client";

import { addTransitionType, useId, useTransition, startTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { OldSeason, bulkUpdateOldSeasons, bulkDeleteOldSeasons } from "@/lib/actions/old-season";
import { columns, OldSeasonRow } from "./columns";

interface OldSeasonListProps {
  initialData: OldSeason[];
}

export function OldSeasonList({ initialData }: OldSeasonListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { hasPermission, isAdmin } = useAuth();
  const tableId = useId();

  const canCreate = isAdmin() || hasPermission("master.old-season.create");
  const canEdit = isAdmin() || hasPermission("master.old-season.update");
  const canDelete = isAdmin() || hasPermission("master.old-season.delete");

  const onBulkEdit = async (rows: { id: string; name: string; status?: string }[]) => {
    startTransition(async () => {
      const result = await bulkUpdateOldSeasons(rows);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const onMultiDelete = async (ids: string[]) => {
    startTransition(async () => {
      const result = await bulkDeleteOldSeasons(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: OldSeasonRow[] = initialData.map((item) => ({
    ...item,
    id: item.id,
  }));

  return (
    <DataTable
      columns={columns}
      data={data}
      searchFields={[{ key: "name", label: "Name" }]}
      actionText={canCreate ? "Add Old Season" : undefined}
      toggleAction={canCreate ? () => {
        startTransition(() => {
          addTransitionType("nav-forward");
          router.push("/master/old-season/add");
        });
      } : undefined}
      onBulkEdit={canEdit ? onBulkEdit : undefined}
      onMultiDelete={canDelete ? onMultiDelete : undefined}
      tableId={tableId}
      canBulkEdit={canEdit}
      canBulkDelete={canDelete}
    />
  );
}
