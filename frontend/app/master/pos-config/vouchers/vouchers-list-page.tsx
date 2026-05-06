"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { addTransitionType } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Info, Plus, XCircle, Gift } from "lucide-react";
import { toast } from "sonner";
import { Voucher, voidVoucher } from "@/lib/actions/vouchers";
import { formatCurrency } from "@/lib/utils";

interface Props { vouchers: Voucher[] }

export function VouchersListPage({ vouchers }: Props) {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [voidId, setVoidId] = useState<string | null>(null);

    const canCreate = hasPermission("pos.voucher.create");
    const canVoid = hasPermission("pos.voucher.void");

    const handleVoid = () => {
        if (!voidId) return;
        startTransition(async () => {
            const result = await voidVoucher(voidId);
            if (result.status) {
                toast.success("Voucher voided");
                setVoidId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <div className="space-y-4">
            <Alert className="bg-muted/50 text-muted-foreground border-none">
                <Info className="h-4 w-4" />
                <AlertTitle>Vouchers</AlertTitle>
                <AlertDescription>
                    Manage Gift, Credit, Corporate, and Outlet Gift vouchers. Exchange vouchers are auto-issued by the system during returns. Vouchers can be voided but never deleted.
                </AlertDescription>
            </Alert>

            <div className="flex justify-end">
                {canCreate && (
                    <Button
                        className="gap-2"
                        onClick={() => {
                            startTransition(() => {
                                addTransitionType("nav-forward");
                                router.push("/master/pos-config/vouchers/new");
                            });
                        }}
                    >
                        <Plus className="h-4 w-4" /> Issue Voucher
                    </Button>
                )}
            </div>

            <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead>Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead>Locations</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vouchers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    No vouchers issued yet
                                </TableCell>
                            </TableRow>
                        ) : vouchers.map((v) => {
                            const isExpired = v.expiresAt ? new Date(v.expiresAt) < new Date() : false;
                            const statusLabel = !v.isActive ? "Voided" : v.isRedeemed ? "Redeemed" : isExpired ? "Expired" : "Active";
                            const statusVariant = !v.isActive ? "secondary" : v.isRedeemed ? "default" : isExpired ? "outline" : "default";
                            return (
                                <TableRow key={v.id}>
                                    <TableCell>
                                        <span className="font-mono font-bold text-primary text-sm">{v.code}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">{v.voucherType.replace("_", " ")}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                                        {v.description || v.companyName || "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold font-mono">
                                        {formatCurrency(Number(v.faceValue))}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {v.locations.length === 0
                                                ? <Badge variant="secondary" className="text-[10px]">All Locations</Badge>
                                                : v.locations.slice(0, 2).map((l) => (
                                                    <Badge key={l.id} variant="secondary" className="text-[10px]">{l.location.name}</Badge>
                                                ))}
                                            {v.locations.length > 2 && (
                                                <Badge variant="secondary" className="text-[10px]">+{v.locations.length - 2}</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : "No expiry"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant as any}>{statusLabel}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {v.isActive && !v.isRedeemed && canVoid && (
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                onClick={() => setVoidId(v.id)}
                                            >
                                                <XCircle className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!voidId} onOpenChange={() => setVoidId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Void Voucher?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently deactivate the voucher. It cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleVoid} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Void
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
