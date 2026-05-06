"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, UnitOfMeasurementRow } from "./columns";
import {
    UnitOfMeasurement,
    deleteUnitsOfMeasurement,
    updateUnitsOfMeasurement,
} from "@/lib/actions/unit-of-measurement";
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
import { Label } from "@/components/ui/label";

interface UnitOfMeasurementListProps {
    initialUnits: UnitOfMeasurement[];
    newItemId?: string;
}

export function UnitOfMeasurementList({
    initialUnits,
    newItemId,
}: UnitOfMeasurementListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [editRows, setEditRows] = useState<{ id: string; name: string; abbreviation: string }[]>([]);
    const { hasPermission } = useAuth();
    const showAddAction = hasPermission("master.unit-of-measurement.create");
    const canBulkEdit = hasPermission("master.unit-of-measurement.update");
    const canBulkDelete = hasPermission("master.unit-of-measurement.delete");

    const handleToggle = () => {
        startTransition(() => {
            addTransitionType("nav-forward");
            router.push("/master/unit-of-measurement/add");
        });
    };

    const handleMultiDelete = (ids: string[]) => {
        startTransition(async () => {
            const result = await deleteUnitsOfMeasurement(ids);
            if (result.status) {
                toast.success(result.message || "Units of measurement deleted successfully");
                router.refresh();
            } else {
                toast.error(result.message || "Failed to delete units of measurement");
            }
        });
    };

    const handleBulkEdit = (items: UnitOfMeasurementRow[]) => {
        setEditRows(
            items.map((item) => ({
                id: item.id,
                name: item.name,
                abbreviation: item.abbreviation,
            }))
        );
        setBulkEditOpen(true);
    };

    const updateEditRow = (id: string, field: "name" | "abbreviation", value: string) => {
        setEditRows((rows) =>
            rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const handleBulkEditSubmit = async () => {
        const validRows = editRows.filter((r) => r.name.trim() && r.abbreviation.trim());
        if (validRows.length === 0) {
            toast.error("Please fill in all fields");
            return;
        }

        startTransition(async () => {
            const result = await updateUnitsOfMeasurement(validRows);
            if (result.status) {
                toast.success(result.message || "Units of measurement updated successfully");
                setBulkEditOpen(false);
                router.refresh();
            } else {
                toast.error(result.message || "Failed to update units of measurement");
            }
        });
    };

    // Transform data to include string id for DataTable
    const data: UnitOfMeasurementRow[] = initialUnits.map((unit) => ({
        ...unit,
        id: unit.id.toString(),
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Units of Measurement</h2>
                <p className="text-muted-foreground">
                    Manage your organization units of measurement
                </p>
            </div>

            <DataTable<UnitOfMeasurementRow>
                columns={columns}
                data={data}
                actionText={showAddAction ? "Add Unit" : undefined}
                toggleAction={showAddAction ? handleToggle : undefined}
                newItemId={newItemId}
                searchFields={[
                    { key: "name", label: "Name" },
                    { key: "abbreviation", label: "Abbreviation" }
                ]}
                onMultiDelete={handleMultiDelete}
                onBulkEdit={handleBulkEdit}
                canBulkEdit={canBulkEdit}
                canBulkDelete={canBulkDelete}
                tableId="unit-of-measurement-list"
            />

            {/* Bulk Edit Dialog */}
            <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Units of Measurement</DialogTitle>
                        <DialogDescription>
                            Update {editRows.length} unit(s) of measurement
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
                        {editRows.map((row, index) => (
                            <div key={row.id} className="space-y-2 p-3 border rounded-md">
                                <Label className="text-xs text-muted-foreground">Unit {index + 1}</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        placeholder="Name"
                                        value={row.name}
                                        onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                                        disabled={isPending}
                                    />
                                    <Input
                                        placeholder="Abbreviation"
                                        value={row.abbreviation}
                                        onChange={(e) => updateEditRow(row.id, "abbreviation", e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
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
