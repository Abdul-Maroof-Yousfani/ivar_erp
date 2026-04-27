"use client";

import { addTransitionType, useState, useTransition, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/common/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import {
    Plus,
    Loader2,
    EllipsisIcon,
    Pencil,
    Trash2,
    Megaphone,
    Ticket,
    Handshake,
    MapPin,
    Search,
    Gift,
    RefreshCw as ExchangeIcon,
    CreditCard,
    Building2,
    XCircle,
    Copy,
    CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
    PromoCampaign,
    CouponCode,
    AllianceDiscount,
    createPromo,
    updatePromo,
    deletePromo,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    createAlliance,
    updateAlliance,
    deleteAlliance,
} from "@/lib/actions/pos-config";
import { issueVoucher, voidVoucher, type Voucher, type VoucherType } from "@/lib/actions/vouchers";
import { Location } from "@/lib/actions/location";
import { cn, formatCurrency } from "@/lib/utils";
import React from "react";

interface Props {
    promos: PromoCampaign[];
    coupons: CouponCode[];
    alliances: AllianceDiscount[];
    locations: Location[];
    vouchers: Voucher[];
    defaultTab?: string;
}

// ── Location Multi-Select ───────────────────────────────────────
function LocationMultiSelect({
    locations,
    selected,
    onChange,
    disabled,
}: {
    locations: Location[];
    selected: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}) {
    const [search, setSearch] = React.useState("");

    const filtered = locations.filter(
        (loc) =>
            loc.name.toLowerCase().includes(search.toLowerCase()) ||
            loc.code.toLowerCase().includes(search.toLowerCase())
    );

    const toggle = (id: string) => {
        onChange(
            selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
        );
    };

    const isAllSelected = filtered.length > 0 && filtered.every((l) => selected.includes(l.id));

    const toggleAll = () => {
        if (isAllSelected) {
            onChange(selected.filter((id) => !filtered.some((l) => l.id === id)));
        } else {
            const newIds = filtered.map((l) => l.id).filter((id) => !selected.includes(id));
            onChange([...selected, ...newIds]);
        }
    };

    return (
        <div className="border rounded-lg p-3 space-y-2">
            {/* Search */}
            <div className="relative flex gap-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="Search by name or code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={disabled}
                />
            </div>

            {/* Select All (acts on filtered results) */}
            {filtered.length > 0 && (
                <div className="flex items-center justify-between">

                    <span className="text-xs text-muted-foreground">
                        {selected.length} / {locations.length} selected
                    </span>    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={toggleAll}
                        disabled={disabled}
                        className="text-xs h-7"
                    >
                        {isAllSelected ? "Deselect Visible" : "Select All Visible"}
                    </Button>
                </div>
            )}

            {/* Location list */}
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {filtered.map((loc) => (
                    <label
                        key={loc.id}
                        className="flex items-center gap-3 cursor-pointer text-sm hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                    >
                        <Checkbox
                            checked={selected.includes(loc.id)}
                            onCheckedChange={() => toggle(loc.id)}
                            disabled={disabled}
                            className="shrink-0"
                        />
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1">{loc.name}</span>
                        <span className="text-muted-foreground text-xs shrink-0 font-mono">({loc.code})</span>
                    </label>
                ))}
                {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground italic px-2 py-2">
                        {search ? `No locations match "${search}"` : "No locations available"}
                    </p>
                )}
            </div>
        </div>
    );
}

export function PosConfigPage({ promos, coupons, alliances, locations, vouchers, defaultTab }: Props) {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();

    // ─── Permissions ────────────────────────────────────────
    const canCreatePromo = hasPermission("master.promo.create");
    const canUpdatePromo = hasPermission("master.promo.update");
    const canDeletePromo = hasPermission("master.promo.delete");

    const canCreateCoupon = hasPermission("master.coupon.create");
    const canUpdateCoupon = hasPermission("master.coupon.update");
    const canDeleteCoupon = hasPermission("master.coupon.delete");

    const canCreateAlliance = hasPermission("master.alliance.create");
    const canUpdateAlliance = hasPermission("master.alliance.update");
    const canDeleteAlliance = hasPermission("master.alliance.delete");

    // ─── Promo Dialog ────────────────────────────────────────
    const [promoDialog, setPromoDialog] = useState(false);
    const [editingPromo, setEditingPromo] = useState<PromoCampaign | null>(null);
    const [promoLocationIds, setPromoLocationIds] = useState<string[]>([]);
    const [deletePromoId, setDeletePromoId] = useState<string | null>(null);

    // ─── Coupon Dialog ───────────────────────────────────────
    const [couponDialog, setCouponDialog] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<CouponCode | null>(null);
    const [couponLocationIds, setCouponLocationIds] = useState<string[]>([]);
    const [deleteCouponId, setDeleteCouponId] = useState<string | null>(null);

    // ─── Alliance Dialog ─────────────────────────────────────
    const [allianceDialog, setAllianceDialog] = useState(false);
    const [editingAlliance, setEditingAlliance] = useState<AllianceDiscount | null>(null);
    const [allianceLocationIds, setAllianceLocationIds] = useState<string[]>([]);
    const [deleteAllianceId, setDeleteAllianceId] = useState<string | null>(null);

    // ─── Voucher Dialog ──────────────────────────────────────
    const [voucherDialog, setVoucherDialog] = useState(false);
    const [voucherType, setVoucherType] = useState<VoucherType>("GIFT");
    const [voucherFaceValue, setVoucherFaceValue] = useState<number | "">("");
    const [voucherDescription, setVoucherDescription] = useState("");
    const [voucherCompany, setVoucherCompany] = useState("");
    const [voucherExpiresAt, setVoucherExpiresAt] = useState("");
    const [voucherLocationIds, setVoucherLocationIds] = useState<string[]>([]);
    const [issuedVoucher, setIssuedVoucher] = useState<Voucher | null>(null);
    const [voidVoucherId, setVoidVoucherId] = useState<string | null>(null);
    const canCreateVoucher = hasPermission("pos.voucher.create");
    const canVoidVoucher = hasPermission("pos.voucher.void");

    const VOUCHER_TYPE_OPTIONS: { value: VoucherType; label: string }[] = [
        { value: "GIFT", label: "Gift Voucher" },
        { value: "CREDIT", label: "Credit Voucher" },
        { value: "CORPORATE", label: "Corporate Gift" },
        { value: "OUTLET_GIFT", label: "Outlet Gift" },
    ];

    const handleIssueVoucher = () => {
        if (!voucherFaceValue || Number(voucherFaceValue) <= 0) { toast.error("Enter a valid amount"); return; }
        startTransition(async () => {
            const result = await issueVoucher({
                voucherType,
                faceValue: Number(voucherFaceValue),
                description: voucherDescription || undefined,
                companyName: voucherCompany || undefined,
                expiresAt: voucherExpiresAt || undefined,
                locationIds: voucherLocationIds,
            });
            if (result.status) {
                setIssuedVoucher(result.data!);
                setVoucherDialog(false);
                setVoucherFaceValue(""); setVoucherDescription(""); setVoucherCompany(""); setVoucherExpiresAt(""); setVoucherLocationIds([]);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleVoidVoucher = () => {
        if (!voidVoucherId) return;
        startTransition(async () => {
            const result = await voidVoucher(voidVoucherId);
            if (result.status) {
                toast.success("Voucher voided");
                setVoidVoucherId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    // ══════════════════════════════════════════════════════════
    //  Promo Handlers
    // ══════════════════════════════════════════════════════════

    const openAddPromo = () => {
        setEditingPromo(null);
        setPromoLocationIds([]);
        setPromoDialog(true);
    };

    const openEditPromo = (promo: PromoCampaign) => {
        setEditingPromo(promo);
        setPromoLocationIds(promo.locations.map((l) => l.location.id));
        setPromoDialog(true);
    };

    const handlePromoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = {
            name: fd.get("name") as string,
            code: fd.get("code") as string,
            type: fd.get("type") as string,
            value: Number(fd.get("value")),
            minOrderAmount: fd.get("minOrderAmount") ? Number(fd.get("minOrderAmount")) : undefined,
            maxDiscount: fd.get("maxDiscount") ? Number(fd.get("maxDiscount")) : undefined,
            startDate: fd.get("startDate") as string,
            endDate: fd.get("endDate") as string,
            isActive: true,
            locationIds: promoLocationIds,
        };

        startTransition(async () => {
            const result = editingPromo
                ? await updatePromo(editingPromo.id, data)
                : await createPromo(data);
            if (result.status) {
                toast.success(result.message);
                setPromoDialog(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleDeletePromo = () => {
        if (!deletePromoId) return;
        startTransition(async () => {
            const result = await deletePromo(deletePromoId);
            if (result.status) {
                toast.success(result.message);
                setDeletePromoId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    // ══════════════════════════════════════════════════════════
    //  Coupon Handlers
    // ══════════════════════════════════════════════════════════

    const openAddCoupon = () => {
        setEditingCoupon(null);
        setCouponLocationIds([]);
        setCouponDialog(true);
    };

    const openEditCoupon = (coupon: CouponCode) => {
        setEditingCoupon(coupon);
        setCouponLocationIds(coupon.locations.map((l) => l.location.id));
        setCouponDialog(true);
    };

    const handleCouponSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = {
            code: fd.get("code") as string,
            description: (fd.get("description") as string) || undefined,
            discountType: fd.get("discountType") as string,
            discountValue: Number(fd.get("discountValue")),
            maxUses: fd.get("maxUses") ? Number(fd.get("maxUses")) : undefined,
            minOrderAmount: fd.get("minOrderAmount") ? Number(fd.get("minOrderAmount")) : undefined,
            maxDiscount: fd.get("maxDiscount") ? Number(fd.get("maxDiscount")) : undefined,
            expiresAt: (fd.get("expiresAt") as string) || undefined,
            isActive: true,
            locationIds: couponLocationIds,
        };

        startTransition(async () => {
            const result = editingCoupon
                ? await updateCoupon(editingCoupon.id, data)
                : await createCoupon(data);
            if (result.status) {
                toast.success(result.message);
                setCouponDialog(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleDeleteCoupon = () => {
        if (!deleteCouponId) return;
        startTransition(async () => {
            const result = await deleteCoupon(deleteCouponId);
            if (result.status) {
                toast.success(result.message);
                setDeleteCouponId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    // ══════════════════════════════════════════════════════════
    //  Alliance Handlers
    // ══════════════════════════════════════════════════════════

    const openAddAlliance = () => {
        setEditingAlliance(null);
        setAllianceLocationIds([]);
        setAllianceDialog(true);
    };

    const openEditAlliance = (alliance: AllianceDiscount) => {
        setEditingAlliance(alliance);
        setAllianceLocationIds(alliance.locations.map((l) => l.location.id));
        setAllianceDialog(true);
    };

    const handleAllianceSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = {
            partnerName: fd.get("partnerName") as string,
            code: fd.get("code") as string,
            discountPercent: Number(fd.get("discountPercent")),
            maxDiscount: fd.get("maxDiscount") ? Number(fd.get("maxDiscount")) : undefined,
            description: (fd.get("description") as string) || undefined,
            isActive: true,
            locationIds: allianceLocationIds,
        };

        startTransition(async () => {
            const result = editingAlliance
                ? await updateAlliance(editingAlliance.id, data)
                : await createAlliance(data);
            if (result.status) {
                toast.success(result.message);
                setAllianceDialog(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleDeleteAlliance = () => {
        if (!deleteAllianceId) return;
        startTransition(async () => {
            const result = await deleteAlliance(deleteAllianceId);
            if (result.status) {
                toast.success(result.message);
                setDeleteAllianceId(null);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const promoColumns: ColumnDef<PromoCampaign>[] = [
        { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { accessorKey: "code", header: "Code", cell: ({ row }) => <Badge variant="outline">{row.original.code}</Badge> },
        { accessorKey: "type", header: "Type", cell: ({ row }) => <span className="capitalize">{row.original.type.replace(/_/g, " ")}</span> },
        { accessorKey: "value", header: "Value", cell: ({ row }) => <div className="text-right">{row.original.type === "percent" ? `${row.original.value}%` : row.original.value.toLocaleString()}</div> },
        { id: "dateRange", header: "Date Range", cell: ({ row }) => <span className="text-xs">{new Date(row.original.startDate).toLocaleDateString()} → {new Date(row.original.endDate).toLocaleDateString()}</span> },
        {
            id: "locations", header: "Locations", cell: ({ row }) => {
                const p = row.original;
                return (
                    <div className="flex flex-wrap gap-1">
                        {p.locations.slice(0, 3).map((l) => (
                            <Badge key={l.id} variant="secondary" className="text-[10px]">{l.location.name}</Badge>
                        ))}
                        {p.locations.length > 3 && <Badge variant="secondary" className="text-[10px]">+{p.locations.length - 3}</Badge>}
                    </div>
                );
            }
        },
        {
            accessorKey: "isActive", header: "Status", cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "default" : "secondary"}>
                    {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
            )
        }
    ];

    const couponColumns: ColumnDef<CouponCode>[] = [
        { accessorKey: "code", header: "Code", cell: ({ row }) => <Badge variant="outline" className="font-mono">{row.original.code}</Badge> },
        { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="text-sm">{row.original.description || "—"}</span> },
        { accessorKey: "discountValue", header: "Discount", cell: ({ row }) => <span>{row.original.discountType === "percent" ? `${row.original.discountValue}%` : row.original.discountValue.toLocaleString()}</span> },
        { id: "usage", header: "Usage", cell: ({ row }) => <div className="text-center">{row.original.usedCount}{row.original.maxUses ? `/${row.original.maxUses}` : ""}</div> },
        { accessorKey: "expiresAt", header: "Expires", cell: ({ row }) => <span className="text-xs">{row.original.expiresAt ? new Date(row.original.expiresAt).toLocaleDateString() : "No expiry"}</span> },
        {
            id: "locations", header: "Locations", cell: ({ row }) => {
                const c = row.original;
                return (
                    <div className="flex flex-wrap gap-1">
                        {c.locations.slice(0, 3).map((l) => (
                            <Badge key={l.id} variant="secondary" className="text-[10px]">{l.location.name}</Badge>
                        ))}
                        {c.locations.length > 3 && <Badge variant="secondary" className="text-[10px]">+{c.locations.length - 3}</Badge>}
                    </div>
                );
            }
        },
        {
            accessorKey: "isActive", header: "Status", cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "default" : "secondary"}>
                    {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
            )
        }
    ];

    const allianceColumns: ColumnDef<AllianceDiscount>[] = [
        { accessorKey: "partnerName", header: "Partner Name", cell: ({ row }) => <span className="font-medium">{row.original.partnerName}</span> },
        { accessorKey: "code", header: "Code", cell: ({ row }) => <Badge variant="outline">{row.original.code}</Badge> },
        { accessorKey: "discountPercent", header: "Discount %", cell: ({ row }) => <div className="text-right">{row.original.discountPercent}%</div> },
        { accessorKey: "maxDiscount", header: "Max Cap", cell: ({ row }) => <div className="text-right">{row.original.maxDiscount ? row.original.maxDiscount.toLocaleString() : "—"}</div> },
        { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="text-sm">{row.original.description || "—"}</span> },
        {
            id: "locations", header: "Locations", cell: ({ row }) => {
                const a = row.original;
                return (
                    <div className="flex flex-wrap gap-1">
                        {a.locations.slice(0, 3).map((l) => (
                            <Badge key={l.id} variant="secondary" className="text-[10px]">{l.location.name}</Badge>
                        ))}
                        {a.locations.length > 3 && <Badge variant="secondary" className="text-[10px]">+{a.locations.length - 3}</Badge>}
                    </div>
                );
            }
        },
        {
            accessorKey: "isActive", header: "Status", cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "default" : "secondary"}>
                    {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">POS Configuration</h2>
                <p className="text-muted-foreground">Manage promo campaigns, coupon codes, and alliance discounts for POS locations</p>
            </div>

            <Tabs
                value={defaultTab || "promos"}
                className="w-full"
                onValueChange={(val) => {
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push(`/master/pos-config?tab=${val}`);
                    });
                }}
            >
                <TabsList className="grid w-full grid-cols-4">
                    <PermissionGuard permissions="master.promo.read" fallback={null}>
                        <TabsTrigger value="promos" className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4" />
                            Promos ({promos.length})
                        </TabsTrigger>
                    </PermissionGuard>
                    <PermissionGuard permissions="master.coupon.read" fallback={null}>
                        <TabsTrigger value="coupons" className="flex items-center gap-2">
                            <Ticket className="h-4 w-4" />
                            Coupons ({coupons.length})
                        </TabsTrigger>
                    </PermissionGuard>
                    <PermissionGuard permissions="master.alliance.read" fallback={null}>
                        <TabsTrigger value="alliances" className="flex items-center gap-2">
                            <Handshake className="h-4 w-4" />
                            Alliances ({alliances.length})
                        </TabsTrigger>
                    </PermissionGuard>
                    <PermissionGuard permissions="pos.voucher.view" fallback={null}>
                        <TabsTrigger value="vouchers" className="flex items-center gap-2">
                            <Gift className="h-4 w-4" />
                            Vouchers ({vouchers.length})
                        </TabsTrigger>
                    </PermissionGuard>
                </TabsList>

                {/* ═══════ PROMOS TAB ═══════ */}
                <PermissionGuard permissions="master.promo.read" fallback={null}>
                    <TabsContent value="promos" className="space-y-4">
                        <Alert className="bg-muted/50 text-muted-foreground border-none">
                            <Info className="h-4 w-4" />
                            <AlertTitle>When to use Promos?</AlertTitle>
                            <AlertDescription>
                                Promos are store-wide or location-wide sales events (e.g., "Summer Sale"). They apply automatically to eligible orders during their active dates without requiring a code.
                            </AlertDescription>
                        </Alert>
                        <DataTable
                            columns={promoColumns}
                            data={promos}
                            title="Promos"
                            tableId="pos-promos-table"
                            searchFields={[
                                { key: "name", label: "Name" },
                                { key: "code", label: "Code" }
                            ]}
                            toggleAction={canCreatePromo ? openAddPromo : undefined}
                            actionText="Add Promo Campaign"
                            onRowEdit={canUpdatePromo ? openEditPromo : undefined}
                            onRowDelete={canDeletePromo ? (p) => setDeletePromoId(p.id) : undefined}
                            canBulkDelete={false}
                            canBulkEdit={false}
                        />
                    </TabsContent>
                </PermissionGuard>

                {/* ═══════ COUPONS TAB ═══════ */}
                <PermissionGuard permissions="master.coupon.read" fallback={null}>
                    <TabsContent value="coupons" className="space-y-4">
                        <Alert className="bg-muted/50 text-muted-foreground border-none">
                            <Info className="h-4 w-4" />
                            <AlertTitle>When to use Coupons?</AlertTitle>
                            <AlertDescription>
                                Coupons are hidden discounts that require the customer or cashier to enter a specific alphanumeric code at checkout (e.g., "WELCOME10"). They often have usage limits.
                            </AlertDescription>
                        </Alert>
                        <DataTable
                            columns={couponColumns}
                            data={coupons}
                            title="Coupons"
                            tableId="pos-coupons-table"
                            searchFields={[
                                { key: "code", label: "Code" },
                                { key: "description", label: "Description" }
                            ]}
                            toggleAction={canCreateCoupon ? openAddCoupon : undefined}
                            actionText="Add Coupon Code"
                            onRowEdit={canUpdateCoupon ? openEditCoupon : undefined}
                            onRowDelete={canDeleteCoupon ? (c) => setDeleteCouponId(c.id) : undefined}
                            canBulkDelete={false}
                            canBulkEdit={false}
                        />
                    </TabsContent>
                </PermissionGuard>

                {/* ═══════ ALLIANCES TAB ═══════ */}
                <PermissionGuard permissions="master.alliance.read" fallback={null}>
                    <TabsContent value="alliances" className="space-y-4">
                        <Alert className="bg-muted/50 text-muted-foreground border-none">
                            <Info className="h-4 w-4" />
                            <AlertTitle>When to use Alliances?</AlertTitle>
                            <AlertDescription>
                                Alliances are standing agreements with partner organizations or banks (e.g., "Meezan Bank 25% Classic Card", "Student ID 15%"). Cashiers apply these after verifying eligibility.
                            </AlertDescription>
                        </Alert>
                        <DataTable
                            columns={allianceColumns}
                            data={alliances}
                            title="Alliances"
                            tableId="pos-alliances-table"
                            searchFields={[
                                { key: "partnerName", label: "Partner Name" },
                                { key: "code", label: "Code" }
                            ]}
                            toggleAction={canCreateAlliance ? openAddAlliance : undefined}
                            actionText="Add Alliance Discount"
                            onRowEdit={canUpdateAlliance ? openEditAlliance : undefined}
                            onRowDelete={canDeleteAlliance ? (a) => setDeleteAllianceId(a.id) : undefined}
                            canBulkDelete={false}
                            canBulkEdit={false}
                        />
                    </TabsContent>
                </PermissionGuard>

                {/* ═══════ VOUCHERS TAB ═══════ */}
                <PermissionGuard permissions="pos.voucher.view" fallback={null}>
                    <TabsContent value="vouchers" className="space-y-4">
                        <Alert className="bg-muted/50 text-muted-foreground border-none">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Vouchers</AlertTitle>
                            <AlertDescription>
                                Manage Gift, Credit, Corporate, and Outlet Gift vouchers. Exchange vouchers are auto-issued by the system during returns.
                            </AlertDescription>
                        </Alert>
                        <div className="flex justify-end">
                            {canCreateVoucher && (
                                <Button onClick={() => setVoucherDialog(true)} className="gap-2">
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
                                        const statusCls = !v.isActive ? "secondary" : v.isRedeemed ? "default" : isExpired ? "outline" : "default";
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
                                                    <Badge variant={statusCls as any}>{statusLabel}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {v.isActive && !v.isRedeemed && canVoidVoucher && (
                                                        <Button variant="ghost" size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => setVoidVoucherId(v.id)}>
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
                    </TabsContent>
                </PermissionGuard>
            </Tabs>

            {/* ═══════ PROMO ADD/EDIT DIALOG ═══════ */}
            <Dialog open={promoDialog} onOpenChange={setPromoDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingPromo ? "Edit" : "Add"} Promo Campaign</DialogTitle>
                        <DialogDescription>Create promotional offers scoped to specific locations</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePromoSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="promo-name">Campaign Name</Label>
                                    <Input id="promo-name" name="name" defaultValue={editingPromo?.name} required disabled={isPending} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="promo-code">Code</Label>
                                    <Input id="promo-code" name="code" defaultValue={editingPromo?.code} required disabled={isPending} className="uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select name="type" defaultValue={editingPromo?.type || "percent"} disabled={isPending}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percent">Percentage</SelectItem>
                                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                                            <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="promo-value">Value</Label>
                                    <Input id="promo-value" name="value" type="number" step="0.01" defaultValue={editingPromo?.value} required disabled={isPending} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="promo-max">Max Discount</Label>
                                    <Input id="promo-max" name="maxDiscount" type="number" step="0.01" defaultValue={editingPromo?.maxDiscount ?? ""} disabled={isPending} placeholder="No limit" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="promo-min">Min Order Amount</Label>
                                    <Input id="promo-min" name="minOrderAmount" type="number" step="0.01" defaultValue={editingPromo?.minOrderAmount ?? ""} disabled={isPending} placeholder="0" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <DatePicker
                                        name="startDate"
                                        value={editingPromo?.startDate ? new Date(editingPromo.startDate).toISOString().split("T")[0] : undefined}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <DatePicker
                                        name="endDate"
                                        value={editingPromo?.endDate ? new Date(editingPromo.endDate).toISOString().split("T")[0] : undefined}
                                        disabled={isPending}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Assign Locations</Label>
                                <LocationMultiSelect locations={locations} selected={promoLocationIds} onChange={setPromoLocationIds} disabled={isPending} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPromoDialog(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingPromo ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ═══════ COUPON ADD/EDIT DIALOG ═══════ */}
            <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingCoupon ? "Edit" : "Add"} Coupon Code</DialogTitle>
                        <DialogDescription>Create discount codes for customers</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCouponSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="coupon-code">Coupon Code</Label>
                                    <Input id="coupon-code" name="code" defaultValue={editingCoupon?.code} required disabled={isPending} className="uppercase font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="coupon-desc">Description</Label>
                                    <Input id="coupon-desc" name="description" defaultValue={editingCoupon?.description ?? ""} disabled={isPending} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Discount Type</Label>
                                    <Select name="discountType" defaultValue={editingCoupon?.discountType || "percent"} disabled={isPending}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percent">Percentage</SelectItem>
                                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="coupon-value">Discount Value</Label>
                                    <Input id="coupon-value" name="discountValue" type="number" step="0.01" defaultValue={editingCoupon?.discountValue} required disabled={isPending} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="coupon-max">Max Discount</Label>
                                    <Input id="coupon-max" name="maxDiscount" type="number" step="0.01" defaultValue={editingCoupon?.maxDiscount ?? ""} disabled={isPending} placeholder="No limit" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="coupon-uses">Max Uses</Label>
                                    <Input id="coupon-uses" name="maxUses" type="number" defaultValue={editingCoupon?.maxUses ?? ""} disabled={isPending} placeholder="Unlimited" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="coupon-min">Min Order Amount</Label>
                                    <Input id="coupon-min" name="minOrderAmount" type="number" step="0.01" defaultValue={editingCoupon?.minOrderAmount ?? ""} disabled={isPending} placeholder="0" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Expiry Date</Label>
                                    <DatePicker
                                        name="expiresAt"
                                        value={editingCoupon?.expiresAt ? new Date(editingCoupon.expiresAt).toISOString().split("T")[0] : undefined}
                                        disabled={isPending}
                                        placeholder="No expiry"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Assign Locations</Label>
                                <LocationMultiSelect locations={locations} selected={couponLocationIds} onChange={setCouponLocationIds} disabled={isPending} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCouponDialog(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingCoupon ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ═══════ ALLIANCE ADD/EDIT DIALOG ═══════ */}
            <Dialog open={allianceDialog} onOpenChange={setAllianceDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingAlliance ? "Edit" : "Add"} Alliance Discount</DialogTitle>
                        <DialogDescription>Configure partner discount agreements</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAllianceSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="alliance-name">Partner Name</Label>
                                    <Input id="alliance-name" name="partnerName" defaultValue={editingAlliance?.partnerName} required disabled={isPending} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="alliance-code">Code</Label>
                                    <Input id="alliance-code" name="code" defaultValue={editingAlliance?.code} required disabled={isPending} className="uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="alliance-pct">Discount %</Label>
                                    <Input id="alliance-pct" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={editingAlliance?.discountPercent} required disabled={isPending} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="alliance-cap">Max Discount Cap</Label>
                                    <Input id="alliance-cap" name="maxDiscount" type="number" step="0.01" min="0" defaultValue={editingAlliance?.maxDiscount ?? ""} disabled={isPending} placeholder="No cap" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="alliance-desc">Description</Label>
                                    <Input id="alliance-desc" name="description" defaultValue={editingAlliance?.description ?? ""} disabled={isPending} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Assign Locations</Label>
                                <LocationMultiSelect locations={locations} selected={allianceLocationIds} onChange={setAllianceLocationIds} disabled={isPending} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAllianceDialog(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingAlliance ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ═══════ DELETE CONFIRMATIONS ═══════ */}
            <AlertDialog open={!!deletePromoId} onOpenChange={() => setDeletePromoId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Promo Campaign</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePromo} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteCouponId} onOpenChange={() => setDeleteCouponId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Coupon Code</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCoupon} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteAllianceId} onOpenChange={() => setDeleteAllianceId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Alliance Discount</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAlliance} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ═══════ ISSUE VOUCHER DIALOG ═══════ */}
            <Dialog open={voucherDialog} onOpenChange={setVoucherDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gift className="h-5 w-5" /> Issue Voucher
                        </DialogTitle>
                        <DialogDescription>A unique code will be generated automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Voucher Type</Label>
                                <Select value={voucherType} onValueChange={(v) => setVoucherType(v as VoucherType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {VOUCHER_TYPE_OPTIONS.map(({ value, label }) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount (Rs.) *</Label>
                                <Input type="number" min="1" value={voucherFaceValue}
                                    onChange={e => setVoucherFaceValue(e.target.value ? Number(e.target.value) : "")}
                                    placeholder="e.g. 1000" />
                            </div>
                        </div>
                        {voucherType === "CORPORATE" && (
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input value={voucherCompany} onChange={e => setVoucherCompany(e.target.value)} placeholder="e.g. Acme Corp" />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Description (Optional)</Label>
                            <Input value={voucherDescription} onChange={e => setVoucherDescription(e.target.value)} placeholder="e.g. Birthday gift" />
                        </div>
                        <div className="space-y-2">
                            <Label>Expiry Date (Optional)</Label>
                            <Input type="date" value={voucherExpiresAt} onChange={e => setVoucherExpiresAt(e.target.value)}
                                min={new Date().toISOString().split("T")[0]} />
                        </div>
                        <div className="space-y-2">
                            <Label>Allowed Locations (leave empty = all locations)</Label>
                            <LocationMultiSelect locations={locations} selected={voucherLocationIds} onChange={setVoucherLocationIds} disabled={isPending} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setVoucherDialog(false)}>Cancel</Button>
                        <Button onClick={handleIssueVoucher} disabled={isPending} className="gap-2">
                            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Gift className="h-4 w-4" /> Issue Voucher
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Issued Voucher Confirmation */}
            {issuedVoucher && (
                <Dialog open onOpenChange={() => setIssuedVoucher(null)}>
                    <DialogContent className="sm:max-w-[360px]">
                        <div className="pt-4 pb-2 text-center">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                            <h2 className="text-xl font-bold mb-1">Voucher Issued</h2>
                            <div className="bg-muted/50 rounded-xl p-5 border my-4">
                                <p className="text-2xl font-black font-mono tracking-widest text-primary">{issuedVoucher.code}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {formatCurrency(Number(issuedVoucher.faceValue))} · {issuedVoucher.voucherType}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(issuedVoucher.code); toast.success("Copied"); }} className="flex-1 gap-2">
                                    <Copy className="w-4 h-4" /> Copy
                                </Button>
                                <Button onClick={() => setIssuedVoucher(null)} className="flex-1">Done</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Void Voucher Confirm */}
            <AlertDialog open={!!voidVoucherId} onOpenChange={() => setVoidVoucherId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Void Voucher?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently deactivate the voucher. It cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleVoidVoucher} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Void
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
