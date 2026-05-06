"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Info, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { PromoCampaign, deactivatePromo } from "@/lib/actions/pos-config";
import { useState } from "react";
import { addTransitionType } from "react";

interface Props { promos: PromoCampaign[] }

export function PromosListPage({ promos }: Props) {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [deactivateId, setDeactivateId] = useState<string | null>(null);

    const canCreate = hasPermission("master.promo.create");
    const canUpdate = hasPermission("master.promo.update");

    const handleDeactivate = () => {
        if (!deactivateId) return;
        startTransition(async () => {
            const result = await deactivatePromo(deactivateId);
            if (result.status) {
                toast.success("Promo campaign deactivated");
                setDeactivateId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const columns: ColumnDef<PromoCampaign>[] = [
        { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { accessorKey: "code", header: "Code", cell: ({ row }) => <Badge variant="outline" className="font-mono">{row.original.code}</Badge> },
        {
            accessorKey: "type", header: "Type", cell: ({ row }) => (
                <Badge variant="secondary" className="capitalize">{row.original.type.replace("_", " ")}</Badge>
            )
        },
        {
            accessorKey: "value", header: "Value", cell: ({ row }) => (
                <span className="font-mono">{row.original.type === "percent" ? `${row.original.value}%` : `Rs. ${Number(row.original.value).toLocaleString()}`}</span>
            )
        },
        {
            id: "dateRange", header: "Date Range", cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {new Date(row.original.startDate).toLocaleDateString()} – {new Date(row.original.endDate).toLocaleDateString()}
                </span>
            )
        },
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
            id: "deactivate", header: "", cell: ({ row }) => (
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
                <AlertTitle>When to use Promos?</AlertTitle>
                <AlertDescription>
                    Promos are store-wide or location-wide sales events (e.g., "Summer Sale"). They apply automatically to eligible orders during their active dates without requiring a code.
                </AlertDescription>
            </Alert>

            <DataTable
                columns={columns}
                data={promos}
                title="Promo Campaigns"
                tableId="pos-promos-table"
                searchFields={[
                    { key: "name", label: "Name" },
                    { key: "code", label: "Code" },
                ]}
                toggleAction={canCreate ? () => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push("/master/pos-config/promos/new");
                    });
                } : undefined}
                actionText="Add Promo Campaign"
                onRowEdit={canUpdate ? (p) => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push(`/master/pos-config/promos/new?id=${p.id}`);
                    });
                } : undefined}
                canBulkDelete={false}
                canBulkEdit={false}
            />

            <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Promo Campaign?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will stop the promo from applying at checkout. The record is kept for audit purposes and can be reactivated by editing it.
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
        </div>
    );
}
