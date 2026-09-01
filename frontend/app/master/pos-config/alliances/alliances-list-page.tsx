"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { addTransitionType } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Info, PowerOff, Upload, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AllianceDiscount, deactivateAlliance, bulkUpdateAllianceLocations } from "@/lib/actions/pos-config";
import { AllianceBulkUploadModal } from "@/components/master/alliance-bulk-upload-modal";
import { Location } from "@/lib/actions/location";
import { LocationMultiSelect } from "../_components/location-multi-select";

interface Props {
    alliances: AllianceDiscount[];
    locations: Location[];
}

export function AlliancesListPage({ alliances, locations }: Props) {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [deactivateId, setDeactivateId] = useState<string | null>(null);
    const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
    const [bulkUploadId, setBulkUploadId] = useState<string | null>(null);
    
    // Bulk edit state
    const [selectedAlliances, setSelectedAlliances] = useState<AllianceDiscount[]>([]);
    const [bulkLocationsOpen, setBulkLocationsOpen] = useState(false);
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [tableKey, setTableKey] = useState(0);

    const canCreate = hasPermission("master.alliance.create");
    const canUpdate = hasPermission("master.alliance.update");

    const handleDeactivate = () => {
        if (!deactivateId) return;
        startTransition(async () => {
            const result = await deactivateAlliance(deactivateId);
            if (result.status) {
                toast.success("Alliance deactivated");
                setDeactivateId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleBulkEdit = (items: AllianceDiscount[]) => {
        setSelectedAlliances(items);
        setSelectedLocationIds([]);
        setBulkLocationsOpen(true);
    };

    const handleBulkLocationsSubmit = () => {
        if (selectedAlliances.length === 0) return;
        startTransition(async () => {
            const allianceIds = selectedAlliances.map(a => a.id);
            const result = await bulkUpdateAllianceLocations(allianceIds, selectedLocationIds);
            if (result.status) {
                toast.success(result.message || "Locations updated successfully");
                setBulkLocationsOpen(false);
                setSelectedAlliances([]);
                setTableKey(prev => prev + 1); // Reset table selection
                router.refresh();
            } else {
                toast.error(result.message || "Failed to update locations");
            }
        });
    };

    const columns: ColumnDef<AllianceDiscount>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 28,
        },
        { accessorKey: "partnerName", header: "Partner Name", cell: ({ row }) => <span className="font-medium">{row.original.partnerName}</span> },
        { accessorKey: "code", header: "Code", cell: ({ row }) => <Badge variant="outline">{row.original.code}</Badge> },
        { accessorKey: "discountPercent", header: "Discount %", cell: ({ row }) => <span className="font-mono">{row.original.discountPercent}%</span> },
        { accessorKey: "maxDiscount", header: "Max Cap", cell: ({ row }) => <span className="text-sm">{row.original.maxDiscount ? Number(row.original.maxDiscount).toLocaleString() : "—"}</span> },
        {
            id: "binNumbers", header: "BIN Numbers", cell: ({ row }) => {
                const bins: string[] = row.original.binNumbers ?? [];
                if (bins.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                return (
                    <div className="flex flex-wrap gap-1">
                        {bins.slice(0, 4).map((bin) => (
                            <Badge key={bin} variant="outline" className="font-mono text-[10px]">{bin}</Badge>
                        ))}
                        {bins.length > 4 && <Badge variant="secondary" className="text-[10px]">+{bins.length - 4}</Badge>}
                    </div>
                );
            }
        },
        { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="text-sm">{row.original.description || "—"}</span> },
        {
            id: "locations", header: "Locations", cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.locations.slice(0, 3).map((l) => (
                        <Badge key={l.id} variant="secondary" className="text-[10px]">{l.location.name}</Badge>
                    ))}
                    {row.original.locations.length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">+{row.original.locations.length - 3}</Badge>
                    )}
                </div>
            )
        },
        {
            accessorKey: "isActive", header: "Status", cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "default" : "secondary"}>
                    {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
            )
        },
        {
            id: "actions", header: "", cell: ({ row }) => (
                row.original.isActive && canUpdate ? (
                    <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                        onClick={() => setDeactivateId(row.original.id)}
                    >
                        <PowerOff className="h-3 w-3" /> Deactivate
                    </Button>
                ) : null
            )
        },
    ];

    return (
        <div className="space-y-4">
            <Alert className="bg-muted/50 text-muted-foreground border-none">
                <Info className="h-4 w-4" />
                <AlertTitle>When to use Alliances?</AlertTitle>
                <AlertDescription>
                    Alliances are standing agreements with partner banks (e.g., "Meezan Bank 25% Classic Card"). Cashiers apply these after verifying the customer's card BIN or eligibility. Search by BIN at checkout.
                </AlertDescription>
            </Alert>

            {canCreate && (
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkUploadOpen(true)}
                        className="gap-2 font-semibold"
                    >
                        <Upload className="h-4 w-4" />
                        Bulk Import
                    </Button>
                </div>
            )}

            <DataTable
                key={tableKey}
                columns={columns}
                data={alliances}
                title="Alliance Discounts"
                tableId="pos-alliances-table"
                searchFields={[
                    { key: "partnerName", label: "Partner Name" },
                    { key: "code", label: "Code" },
                ]}
                toggleAction={canCreate ? () => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push("/master/pos-config/alliances/new");
                    });
                } : undefined}
                actionText="Add Alliance Discount"
                onRowEdit={canUpdate ? (a) => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push(`/master/pos-config/alliances/new?id=${a.id}`);
                    });
                } : undefined}
                canBulkDelete={false}
                canBulkEdit={canUpdate}
                onBulkEdit={handleBulkEdit}
            />

            <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Alliance?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This alliance will no longer appear at checkout. The record is kept for audit purposes and can be reactivated by editing it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeactivate} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Locations Edit Modal */}
            <Dialog open={bulkLocationsOpen} onOpenChange={setBulkLocationsOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader className="flex flex-col items-center text-center">
                        <div className="p-3 bg-primary/10 text-primary rounded-full mb-2">
                            <MapPin className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-xl font-bold">Assign Locations</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Assign locations to the <span className="font-semibold text-foreground">{selectedAlliances.length}</span> selected alliance discount(s). This will override their current locations.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <LocationMultiSelect
                            locations={locations}
                            selected={selectedLocationIds}
                            onChange={setSelectedLocationIds}
                            disabled={isPending}
                            maxHeight="300px"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setBulkLocationsOpen(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkLocationsSubmit}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Assign Locations
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AllianceBulkUploadModal
                open={bulkUploadOpen}
                onOpenChange={setBulkUploadOpen}
                uploadId={bulkUploadId}
                onUploadIdChange={setBulkUploadId}
                onSuccess={() => router.refresh()}
            />
        </div>
    );
}
