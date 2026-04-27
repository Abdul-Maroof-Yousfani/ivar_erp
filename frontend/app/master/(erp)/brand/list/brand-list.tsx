"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, BrandRow } from "./columns";
import {
    Brand,
    deleteBrands,
    updateBrands,
} from "@/lib/actions/brand";
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

interface BrandListProps {
    initialBrands: Brand[];
    newItemId?: string;
}

export function BrandList({
    initialBrands,
    newItemId,
}: BrandListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [editRows, setEditRows] = useState<{ id: string; name: string }[]>([]);
    const { hasPermission } = useAuth();
    const showAddAction = hasPermission("master.brand.create");
    const canBulkEdit = hasPermission("master.brand.update");
    const canBulkDelete = hasPermission("master.brand.delete");

    const handleToggle = () => {
        startTransition(() => {
            addTransitionType("nav-forward");
            router.push("/master/brand/add");
        });
    };

    const handleMultiDelete = (ids: string[]) => {
        startTransition(async () => {
            const result = await deleteBrands(ids);
            if (result.status) {
                toast.success(result.message || "Brands deleted successfully");
                router.refresh();
            } else {
                toast.error(result.message || "Failed to delete brands");
            }
        });
    };

    const handleBulkEdit = (items: BrandRow[]) => {
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
            const result = await updateBrands(validRows);
            if (result.status) {
                toast.success(result.message || "Brands updated successfully");
                setBulkEditOpen(false);
                router.refresh();
            } else {
                toast.error(result.message || "Failed to update brands");
            }
        });
    };

    // Transform data to include string id for DataTable
    const data: BrandRow[] = initialBrands.map((brand) => ({
        ...brand,
        id: brand.id.toString(),
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Brands</h2>
                <p className="text-muted-foreground">
                    Manage your organization brands
                </p>
            </div>

            <DataTable<BrandRow>
                columns={columns}
                data={data}
                actionText={showAddAction ? "Add Brand" : undefined}
                toggleAction={showAddAction ? handleToggle : undefined}
                newItemId={newItemId}
                searchFields={[{ key: "name", label: "Name" }]}
                onMultiDelete={handleMultiDelete}
                onBulkEdit={handleBulkEdit}
                canBulkEdit={canBulkEdit}
                canBulkDelete={canBulkDelete}
                tableId="brand-list"
            />

            {/* Bulk Edit Dialog */}
            <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Brands</DialogTitle>
                        <DialogDescription>
                            Update {editRows.length} brand(s)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
                        {editRows.map((row, index) => (
                            <div key={row.id} className="flex gap-2">
                                <Input
                                    placeholder={`Brand ${index + 1}`}
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
