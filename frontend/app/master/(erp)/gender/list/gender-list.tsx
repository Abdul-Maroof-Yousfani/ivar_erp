"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, GenderRow } from "./columns";
import {
    Gender,
    deleteGenders,
    updateGenders,
} from "@/lib/actions/gender";
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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface GenderListProps {
    initialGenders: Gender[];
    newItemId?: string;
}

export function GenderList({
    initialGenders,
    newItemId,
}: GenderListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [editRows, setEditRows] = useState<{ id: string; name: string }[]>([]);
    const { hasPermission } = useAuth();
    const showAddAction = hasPermission("master.gender.create");
    const canBulkEdit = hasPermission("master.gender.update");
    const canBulkDelete = hasPermission("master.gender.delete");

    const handleToggle = () => {
        startTransition(() => {
            addTransitionType("nav-forward");
            router.push("/master/gender/add");
        });
    };

    const handleMultiDelete = (ids: string[]) => {
        startTransition(async () => {
            const result = await deleteGenders(ids);
            if (result.status) {
                toast.success(result.message || "Genders deleted successfully");
                router.refresh();
            } else {
                toast.error(result.message || "Failed to delete Genders");
            }
        });
    };

    const handleBulkEdit = (items: GenderRow[]) => {
        setEditRows(
            items.map((item) => ({
                id: item.id,
                name: item.name,
            }))
        );
        setBulkEditOpen(true);
    };

    const updateEditRow = (id: string, value: string) => {
        setEditRows((rows) =>
            rows.map((r) => (r.id === id ? { ...r, name: value } : r))
        );
    };

    const handleBulkEditSubmit = async () => {
        const validRows = editRows.filter((r) => r.name.trim());
        if (validRows.length === 0) {
            toast.error("Please fill in all fields");
            return;
        }

        startTransition(async () => {
            const result = await updateGenders(validRows);
            if (result.status) {
                toast.success(result.message || "Genders updated successfully");
                setBulkEditOpen(false);
                router.refresh();
            } else {
                toast.error(result.message || "Failed to update Genders");
            }
        });
    };

    // Transform data to include string id for DataTable
    const data: GenderRow[] = initialGenders.map((Gender) => ({
        ...Gender,
        id: Gender.id.toString(),
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Genders</h2>
                <p className="text-muted-foreground">
                    Manage your organization Genders
                </p>
            </div>

            <DataTable<GenderRow>
                columns={columns}
                data={data}
                actionText={showAddAction ? "Add Gender" : undefined}
                toggleAction={showAddAction ? handleToggle : undefined}
                newItemId={newItemId}
                searchFields={[{ key: "name", label: "Name" }]}
                onMultiDelete={handleMultiDelete}
                onBulkEdit={handleBulkEdit}
                canBulkEdit={canBulkEdit}
                canBulkDelete={canBulkDelete}
                tableId="gender-list"
            />

            {/* Bulk Edit Dialog */}
            <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Genders</DialogTitle>
                        <DialogDescription>
                            Update {editRows.length} Gender(s)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
                        {editRows.map((row, index) => (
                            <div key={row.id} className="flex gap-2">
                                <Input
                                    placeholder={`Gender ${index + 1}`}
                                    value={row.name}
                                    onChange={(e) => updateEditRow(row.id, e.target.value)}
                                    disabled={isPending}
                                    className="flex-1"
                                />
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
