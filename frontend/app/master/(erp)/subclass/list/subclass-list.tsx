"use client";

import { addTransitionType, useId, useState, useTransition, useMemo, startTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { ItemSubclass, bulkUpdateItemSubclasses, bulkDeleteItemSubclasses } from "@/lib/actions/item-subclass";
import { ItemClass } from "@/lib/actions/item-class";
import { getColumns, SubclassRow } from "./columns";

interface SubclassListProps {
    initialData: ItemSubclass[];
    classes: ItemClass[];
}

export function SubclassList({ initialData, classes }: SubclassListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { hasPermission, isAdmin } = useAuth();
    const tableId = useId();

    const canCreate = isAdmin() || hasPermission("master.item-subclass.create");
    const canEdit = isAdmin() || hasPermission("master.item-subclass.update");
    const canDelete = isAdmin() || hasPermission("master.item-subclass.delete");

    const columns = useMemo(() => getColumns(classes), [classes]);

    const onBulkEdit = async (rows: SubclassRow[]) => {
        if (!canEdit) {
            toast.error("You don't have permission to edit item subclasses");
            return;
        }

        startTransition(async () => {
            const result = await bulkUpdateItemSubclasses(rows.map(r => ({
                id: r.id,
                name: r.name,
                itemClassId: r.itemClassId,
                status: r.status
            })));
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
            toast.error("You don't have permission to delete item subclasses");
            return;
        }

        startTransition(async () => {
            const result = await bulkDeleteItemSubclasses(ids);
            if (result.status) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const data: SubclassRow[] = initialData.map((item) => ({
        ...item,
        id: item.id,
    }));

    const filters = [
        {
            key: "itemClassId",
            label: "Item Class",
            options: classes.map(cls => ({ label: cls.name, value: cls.id }))
        }
    ];

    return (
        <DataTable
            columns={columns}
            data={data}
            searchFields={[{ key: "name", label: "Name" }]}
            actionText={canCreate ? "Add Subclass" : undefined}
            toggleAction={canCreate ? () => {
                startTransition(() => {
                    addTransitionType("nav-forward");
                    router.push("/master/subclass/add");
                });
            } : undefined}
            filters={filters}
            onBulkEdit={canEdit ? onBulkEdit : undefined}
            onMultiDelete={canDelete ? onMultiDelete : undefined}
            tableId={tableId}
            canBulkEdit={canEdit}
            canBulkDelete={canDelete}
        />
    );
}
