"use client";

import { useState, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/common/data-table";
import { columns, SilhouetteRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import Link from "next/link";
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
import { deleteSilhouettes, updateSilhouettes, Silhouette } from "@/lib/actions/silhouette";
import { useAuth } from "@/components/providers/auth-provider";

interface SilhouetteListProps {
    initialSilhouettes: Silhouette[];
    newItemId?: string;
}

export function SilhouetteList({
    initialSilhouettes,
    newItemId,
}: SilhouetteListProps) {
    const router = useRouter();
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [bulkEditDialog, setBulkEditDialog] = useState(false);
    const { hasPermission, isAdmin } = useAuth();

    const canCreate = isAdmin() || hasPermission("master.silhouette.create");
    const canUpdate = isAdmin() || hasPermission("master.silhouette.update");
    const canDelete = isAdmin() || hasPermission("master.silhouette.delete");

    const handleBulkDelete = async () => {
        startTransition(async () => {
            const result = await deleteSilhouettes(selectedRows);
            if (result.status) {
                toast.success(result.message);
                setDeleteDialog(false);
                setSelectedRows([]);
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
                const silhouette = initialSilhouettes.find((s) => s.id === id);
                return {
                    id,
                    name: silhouette?.name || "",
                    status,
                };
            });
            const result = await updateSilhouettes(items);
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

    const data: SilhouetteRow[] = initialSilhouettes.map((silhouette) => ({
        ...silhouette,
        id: silhouette.id.toString(),
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    {selectedRows.length > 0 && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                            {canUpdate && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkEditDialog(true)}
                                    className="h-8 border-dashed"
                                >
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Bulk Edit Status ({selectedRows.length})
                                </Button>
                            )}
                            {canDelete && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setDeleteDialog(true)}
                                    className="h-8"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete ({selectedRows.length})
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                {canCreate && (
                    <Link href="/master/silhouette/add" transitionTypes={["nav-forward"]}>
                        <Button size="sm" className="h-8">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Silhouette
                        </Button>
                    </Link>
                )}
            </div>

            <DataTable<SilhouetteRow>
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
                actionText={canCreate ? "Add Silhouette" : undefined}
                toggleAction={canCreate ? () => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push("/master/silhouette/add");
                    });
                } : undefined}
                tableId="silhouette-list"
            />

            {/* Bulk Delete Dialog */}
            <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete {selectedRows.length} selected silhouettes. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Edit Dialog */}
            <Dialog open={bulkEditDialog} onOpenChange={setBulkEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bulk Edit Status</DialogTitle>
                        <DialogDescription>
                            Update status for {selectedRows.length} selected silhouettes.
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
