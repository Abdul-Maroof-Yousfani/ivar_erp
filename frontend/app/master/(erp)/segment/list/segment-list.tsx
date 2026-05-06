"use client";

import { addTransitionType, useId, useState, useTransition, startTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { Segment, bulkUpdateSegments, bulkDeleteSegments } from "@/lib/actions/segment";
import { columns, SegmentRow } from "./columns";

interface SegmentListProps {
    initialData: Segment[];
}

export function SegmentList({ initialData }: SegmentListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { hasPermission, isAdmin } = useAuth();
    const tableId = useId();

    const canCreate = isAdmin() || hasPermission("master.segment.create");
    const canEdit = isAdmin() || hasPermission("master.segment.update");
    const canDelete = isAdmin() || hasPermission("master.segment.delete");

    const onBulkEdit = async (rows: SegmentRow[]) => {
        if (!canEdit) {
            toast.error("You don't have permission to edit segments");
            return;
        }

        startTransition(async () => {
            const result = await bulkUpdateSegments(rows);
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
            toast.error("You don't have permission to delete segments");
            return;
        }

        startTransition(async () => {
            const result = await bulkDeleteSegments(ids);
            if (result.status) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const data: SegmentRow[] = initialData.map((item) => ({
        ...item,
        id: item.id,
    }));

    return (
        <DataTable
            columns={columns}
            data={data}
            searchFields={[{ key: "name", label: "Name" }]}
            actionText={canCreate ? "Add Segment" : undefined}
            toggleAction={canCreate ? () => {
                startTransition(() => {
                    addTransitionType("nav-forward");
                    router.push("/master/segment/add");
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
