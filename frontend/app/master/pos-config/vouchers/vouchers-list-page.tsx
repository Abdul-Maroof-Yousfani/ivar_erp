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
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Info, Plus, XCircle, Gift, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Voucher, voidVoucher, updateVoucherExpiry } from "@/lib/actions/vouchers";
import { formatCurrency } from "@/lib/utils";

interface Props { vouchers: Voucher[] }

const formatForDateTimeLocal = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const pad = (num: number) => String(num).padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

export function VouchersListPage({ vouchers }: Props) {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [voidId, setVoidId] = useState<string | null>(null);
    const [editExpiryVoucher, setEditExpiryVoucher] = useState<Voucher | null>(null);
    const [expiryValue, setExpiryValue] = useState<string>("");

    const canCreate = hasPermission("pos.voucher.create");
    const canVoid = hasPermission("pos.voucher.void");
    const canEditExpiry = canCreate || canVoid;

    const handleSaveExpiry = () => {
        if (!editExpiryVoucher) return;
        startTransition(async () => {
            const formattedDate = expiryValue ? new Date(expiryValue).toISOString() : null;
            const result = await updateVoucherExpiry(editExpiryVoucher.id, formattedDate);
            if (result.status) {
                toast.success("Voucher expiry updated");
                setEditExpiryVoucher(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

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
                            const statusLabel = !v.isActive ? "redeemed" : v.isRedeemed ? "Redeemed" : isExpired ? "Expired" : "Active";
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
                                    <TableCell className="text-right font-mono">
                                        <div className="font-semibold">{formatCurrency(Number(v.faceValue))}</div>
                                        {v.discount !== undefined && Number(v.discount) > 0 && (
                                            <div className="text-[10px] text-muted-foreground">
                                                Disc: {formatCurrency(Number(v.discount))}
                                            </div>
                                        )}
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
                                    <TableCell className="text-sm">
                                        {v.isActive && !v.isRedeemed && canEditExpiry ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 font-normal text-primary hover:text-primary/80 hover:bg-transparent flex items-center gap-1"
                                                onClick={() => {
                                                    setEditExpiryVoucher(v);
                                                    setExpiryValue(formatForDateTimeLocal(v.expiresAt));
                                                }}
                                            >
                                                <span>
                                                    {v.expiresAt
                                                        ? new Date(v.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                                                        : "No expiry"}
                                                </span>
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        ) : (
                                            <span className="text-muted-foreground px-1">
                                                {v.expiresAt
                                                    ? new Date(v.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                                                    : "No expiry"}
                                            </span>
                                        )}
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

            <Dialog open={!!editExpiryVoucher} onOpenChange={(open) => { if (!open) setEditExpiryVoucher(null); }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Update Expiry Time</DialogTitle>
                        <DialogDescription>
                            Change the expiration date and time for voucher <span className="font-mono font-bold text-foreground">{editExpiryVoucher?.code}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="expiry-time">Expiry Date & Time</Label>
                            <Input
                                id="expiry-time"
                                type="datetime-local"
                                value={expiryValue}
                                onChange={(e) => setExpiryValue(e.target.value)}
                                disabled={isPending}
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setExpiryValue("")}
                            disabled={isPending || !expiryValue}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                        >
                            Clear Expiry
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditExpiryVoucher(null)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveExpiry}
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
