"use client";

import { addTransitionType, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { ItemClass, bulkUpdateItemClasses, bulkDeleteItemClasses } from "@/lib/actions/item-class";
import { columns, ClassRow } from "./columns";

interface ClassListProps {
    initialData: ItemClass[];
}

export function ClassList({ initialData }: ClassListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { hasPermission, isAdmin } = useAuth();
    const tableId = useId();

    const canCreate = isAdmin() || hasPermission("master.item-class.create");
    const canEdit = isAdmin() || hasPermission("master.item-class.update");
    const canDelete = isAdmin() || hasPermission("master.item-class.delete");

    const onBulkEdit = async (rows: ClassRow[]) => {
        if (!canEdit) {
            toast.error("You don't have permission to edit item classes");
            return;
        }

        startTransition(async () => {
            const result = await bulkUpdateItemClasses(rows);
            if (result.status) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const onMultiDelete = async (ids: string[]) => {
        if (!canDelete) {
            toast.error("You don't have permission to delete item classes");
            return;
        }

        startTransition(async () => {
            const result = await bulkDeleteItemClasses(ids);
            if (result.status) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const data: ClassRow[] = initialData.map((item) => ({
        ...item,
        id: item.id,
    }));

    return (
        <DataTable
            columns={columns}
            data={data}
            searchFields={[{ key: "name", label: "Name" }]}
            actionText={canCreate ? "Add Class" : undefined}
            toggleAction={canCreate ? () => {
                startTransition(() => {
                    addTransitionType("nav-forward");
                    router.push("/master/class/add");
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
