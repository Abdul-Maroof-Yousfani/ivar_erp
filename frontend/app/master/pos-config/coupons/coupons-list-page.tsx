"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { addTransitionType } from "react";
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
import { CouponCode, deactivateCoupon } from "@/lib/actions/pos-config";

interface Props { coupons: CouponCode[] }

export function CouponsListPage({ coupons }: Props) {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [deactivateId, setDeactivateId] = useState<string | null>(null);

    const canCreate = hasPermission("master.coupon.create");
    const canUpdate = hasPermission("master.coupon.update");

    const handleDeactivate = () => {
        if (!deactivateId) return;
        startTransition(async () => {
            const result = await deactivateCoupon(deactivateId);
            if (result.status) {
                toast.success("Coupon deactivated");
                setDeactivateId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const columns: ColumnDef<CouponCode>[] = [
        { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono font-bold text-primary">{row.original.code}</span> },
        { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="text-sm">{row.original.description || "—"}</span> },
        {
            id: "discount", header: "Discount", cell: ({ row }) => {
                const c = row.original;
                return (
                    <span className="font-mono text-sm">
                        {c.discountType === "percent" ? `${c.discountValue}%` : `Rs. ${Number(c.discountValue).toLocaleString()}`}
                        {c.maxDiscount ? <span className="text-muted-foreground text-xs ml-1">(max {Number(c.maxDiscount).toLocaleString()})</span> : null}
                    </span>
                );
            }
        },
        {
            id: "usage", header: "Usage", cell: ({ row }) => {
                const c = row.original;
                return (
                    <span className="text-sm font-mono">
                        {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                    </span>
                );
            }
        },
        {
            accessorKey: "expiresAt", header: "Expires", cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {row.original.expiresAt ? new Date(row.original.expiresAt).toLocaleDateString() : "No expiry"}
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
                <AlertTitle>When to use Coupons?</AlertTitle>
                <AlertDescription>
                    Coupons are hidden discounts that require the customer or cashier to enter a specific alphanumeric code at checkout (e.g., "WELCOME10"). They often have usage limits.
                </AlertDescription>
            </Alert>

            <DataTable
                columns={columns}
                data={coupons}
                title="Coupon Codes"
                tableId="pos-coupons-table"
                searchFields={[
                    { key: "code", label: "Code" },
                    { key: "description", label: "Description" },
                ]}
                toggleAction={canCreate ? () => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push("/master/pos-config/coupons/new");
                    });
                } : undefined}
                actionText="Add Coupon Code"
                onRowEdit={canUpdate ? (c) => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push(`/master/pos-config/coupons/new?id=${c.id}`);
                    });
                } : undefined}
                canBulkDelete={false}
                canBulkEdit={false}
            />

            <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Coupon?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This coupon will no longer be accepted at checkout. The record is kept for audit purposes and can be reactivated by editing it.
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
