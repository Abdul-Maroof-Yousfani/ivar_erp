"use client";

import { useState, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/common/data-table";
import { columns, ColorRow } from "./columns";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { deleteColors, updateColors, Color } from "@/lib/actions/color";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ColorListProps {
    initialItems: Color[];
    newItemId?: string;
}

export function ColorList({
    initialItems,
    newItemId,
}: ColorListProps) {
    const router = useRouter();
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [bulkEditDialog, setBulkEditDialog] = useState(false);
    const { hasPermission, isAdmin } = useAuth();

    const canCreate = isAdmin() || hasPermission("master.color.create");
    const canUpdate = isAdmin() || hasPermission("master.color.update");
    const canDelete = isAdmin() || hasPermission("master.color.delete");

    const handleBulkDelete = async (ids: string[]) => {
        startTransition(async () => {
            const result = await deleteColors(ids);
            if (result.status) {
                toast.success(result.message);
                setDeleteDialog(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleBulkEdit = async (formData: FormData) => {
        const status = formData.get("status") as string;
        startTransition(async () => {
            const items = selectedRows.map((id) => {
                const item = initialItems.find((s) => s.id === id);
                return {
                    id,
                    name: item?.name || "",
                    status,
                };
            });
            const result = await updateColors(items);
            if (result.status) {
                toast.success(result.message);
                setBulkEditDialog(false);
                setSelectedRows([]);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const data: ColorRow[] = initialItems.map((item) => ({
        ...item,
        id: item.id.toString(),
    }));

    return (
        <div className="space-y-6">
            <DataTable<ColorRow>
                columns={columns}
                data={data}
                newItemId={newItemId}
                searchFields={[{ key: "name", label: "Name" }]}
                onMultiDelete={handleBulkDelete}
                onBulkEdit={(items) => {
                    setSelectedRows(items.map(i => i.id));
                    setBulkEditDialog(true);
                }}
                canBulkEdit={canUpdate}
                canBulkDelete={canDelete}
                actionText={canCreate ? "Add Color" : undefined}
                toggleAction={canCreate ? () => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push("/master/color/add");
                    });
                } : undefined}
                tableId="color-list"
            />

            {/* Bulk Edit Dialog */}
            <Dialog open={bulkEditDialog} onOpenChange={setBulkEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bulk Edit Status</DialogTitle>
                        <DialogDescription>
                            Update status for {selectedRows.length} selected colors.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={handleBulkEdit}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="bulk-status">Status</Label>
                                <Select name="status" defaultValue="active">
                                    <SelectTrigger id="bulk-status">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setBulkEditDialog(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Status
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
