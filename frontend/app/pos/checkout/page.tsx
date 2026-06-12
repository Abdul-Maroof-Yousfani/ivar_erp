"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { getCookie } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { HoldOrderModal } from "@/components/pos/hold-order-modal";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import type { CartItem } from "@/components/pos/new-sale/cart-table";

// Sub-components
import { CheckoutHeader } from "./_checkout-header";
import { OrderSummary } from "./_order-summary";
import { DiscountPanel } from "./_discount-panel";
import { TotalsPanel, FBR_POS_FEE } from "./_totals-panel";
import { PaymentPanel } from "./_payment-panel";
import type { MerchantConfig } from "./_payment-panel";
import { ActionButtons } from "./_action-buttons";

// ─── Types ──────────────────────────────────────────────────────────────
export interface PromoConfig {
    id: string; name: string; code: string;
    type: "percent" | "fixed" | "buy_x_get_y";
    value: number; minOrderAmount?: number; maxDiscount?: number;
    startDate: string; endDate: string;
}
export interface AllianceConfig {
    id: string; partnerName: string; code: string;
    discountPercent: number; maxDiscount?: number; description?: string;
    binNumbers: string[];
}
export interface AppliedCoupon {
    id: string; code: string; discountType: string;
    discountValue: number; discountAmount: number; description?: string;
}
export interface Tender { method: string; amount: number; cardLast4?: string; slipNo?: string; voucherId?: string; }
export interface Customer { id: string; name: string; code: string; contactNo?: string; address?: string; }
export type DiscountMode = "none" | "promo" | "coupon" | "alliance" | "manual";

function fmtCurrency(val: number) {
    return formatCurrency(val);
}

function calcPromoDiscount(promo: PromoConfig, subtotal: number): number {
    if (promo.type === "percent") {
        let amt = Math.round(subtotal * (Number(promo.value) / 100));
        if (promo.maxDiscount) amt = Math.min(amt, Number(promo.maxDiscount));
        return amt;
    }
    if (promo.type === "fixed") return Math.min(Number(promo.value), subtotal);
    return 0;
}

// ─── Add Customer Modal ─────────────────────────────────────────────────
function AddCustomerModal({ open, onOpenChange, onSuccess }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (customer: Customer) => void;
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: "", contactNo: "", email: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) { toast.error("Name is required"); return; }
        setIsSubmitting(true);
        try {
            const code = `CUST-${Date.now()}`;
            const res = await authFetch("/pos-sales/customers", { method: "POST", body: { ...formData, code } });
            if (res.ok && res.data?.status) {
                toast.success("Customer added successfully");
                onSuccess(res.data.data);
                onOpenChange(false);
                setFormData({ name: "", contactNo: "", email: "" });
            } else {
                toast.error(res.data?.message || "Failed to add customer");
            }
        } catch {
            toast.error("Failed to add customer. Check connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Add New Customer</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Full Name <span className="text-destructive">*</span></Label>
                        <Input
                            placeholder="Customer name"
                            value={formData.name}
                            onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Contact Number</Label>
                        <Input
                            placeholder="e.g. 03001234567"
                            value={formData.contactNo}
                            onChange={e => setFormData(d => ({ ...d, contactNo: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                            type="email"
                            placeholder="e.g. customer@example.com"
                            value={formData.email}
                            onChange={e => setFormData(d => ({ ...d, email: e.target.value }))}
                        />
                    </div>
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Create Customer
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ════════════════════════════════════════════════════════════════════════
export default function CheckoutPage() {
    const router = useRouter();
    const { settings } = usePosSettings();
    const { hasPermission, user } = useAuth();
    const canPromo = hasPermission("pos.checkout.promo");
    const canCoupon = hasPermission("pos.checkout.coupon");
    const canAlliance = hasPermission("pos.checkout.alliance");
    const canManualDiscount = hasPermission("pos.checkout.manual-discount");
    const canAddCustomer = hasPermission("pos.checkout.add-customer");
    const canHold = hasPermission("pos.hold.create");

    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [promos, setPromos] = useState<PromoConfig[]>([]);
    const [alliances, setAlliances] = useState<AllianceConfig[]>([]);
    const [allianceSearch, setAllianceSearch] = useState("");
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);

    // ── Cashier state ──────────────────────────────────────────────────
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [selectedCashierId, setSelectedCashierId] = useState<string>("");
    const [isLoadingCashiers, setIsLoadingCashiers] = useState(false);

    useEffect(() => {
        const saved = sessionStorage.getItem("pos_selected_cashier_id");
        if (saved) setSelectedCashierId(saved);
    }, []);

    useEffect(() => {
        if (selectedCashierId) sessionStorage.setItem("pos_selected_cashier_id", selectedCashierId);
    }, [selectedCashierId]);

    useEffect(() => {
        setIsLoadingCashiers(true);
        authFetch(`/pos-sales/cashiers`)
            .then(res => {
                if (res.ok && res.data?.status) {
                    const list = res.data.data || [];
                    setCashiers(list);
                    if (!sessionStorage.getItem("pos_selected_cashier_id") && user?.id) {
                        if (list.some((c: any) => c.userId === user.id)) setSelectedCashierId(user.id);
                    }
                }
            })
            .catch(() => { })
            .finally(() => setIsLoadingCashiers(false));
    }, [user?.id]);

    // ── Hold state ──────────────────────────────────────────────────────
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [holdOrderId, setHoldOrderId] = useState<string | null>(null);

    // ── Customer state ──────────────────────────────────────────────────
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState("");
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [showAddCustomer, setShowAddCustomer] = useState(false);

    // ── Discount state ─────────────────────────────────────────────────
    const [discountMode, setDiscountMode] = useState<DiscountMode>("none");
    const [selectedPromo, setSelectedPromo] = useState<PromoConfig | null>(null);
    const [promoScopeAll, setPromoScopeAll] = useState(true);
    const [promoScopedItems, setPromoScopedItems] = useState<Set<string>>(new Set());
    const [showPromoScope, setShowPromoScope] = useState(false);
    const [selectedAlliance, setSelectedAlliance] = useState<AllianceConfig | null>(null);
    const [allianceMeta, setAllianceMeta] = useState({ cardholderName: "", cardLast4: "", merchantSlip: "" });
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
    const [couponError, setCouponError] = useState("");
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [manualDiscountType, setManualDiscountType] = useState<"percent" | "flat">("percent");
    const [manualDiscountValue, setManualDiscountValue] = useState<number>(0);

    // ── Payment state ──────────────────────────────────────────────────
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [tenderMethod, setTenderMethod] = useState("cash");
    const [merchants, setMerchants] = useState<MerchantConfig[]>([]);
    const [selectedMerchant, setSelectedMerchant] = useState<MerchantConfig | null>(null);
    const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);

    useEffect(() => {
        if (settings.defaultPaymentMethod) setTenderMethod(settings.defaultPaymentMethod);
    }, [settings.defaultPaymentMethod]);

    useEffect(() => {
        if (discountMode === "alliance" && selectedAlliance) setTenderMethod("card");
    }, [discountMode, selectedAlliance]);

    // ── Fetch merchants for this location ──────────────────────────────
    useEffect(() => {
        setIsLoadingMerchants(true);
        authFetch("/pos-config/merchants/for-location")
            .then(res => {
                if (res.ok && res.data?.status) {
                    const list: MerchantConfig[] = res.data.data || [];
                    setMerchants(list);
                    // Auto-select if only one merchant
                    if (list.length === 1) setSelectedMerchant(list[0]);
                }
            })
            .catch(() => { })
            .finally(() => setIsLoadingMerchants(false));
    }, []);

    const [tenderAmount, setTenderAmount] = useState<number>(0);
    const [tenderCardholderName, setTenderCardholderName] = useState("");
    const [tenderCardLast4, setTenderCardLast4] = useState("");
    const [tenderSlip, setTenderSlip] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<any>(null);
    const [isGiftReceipt, setIsGiftReceipt] = useState(false);
    const [showGiftReceiptAfterSales, setShowGiftReceiptAfterSales] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);

    // ── Voucher tender state ───────────────────────────────────────────
    const [voucherCode, setVoucherCode] = useState("");
    const [voucherValidating, setVoucherValidating] = useState(false);
    const [validatedVoucher, setValidatedVoucher] = useState<{
        id: string; code: string; voucherType: string;
        faceValue: number; description?: string;
        customerId?: string; requireCustomerMatch: boolean;
    } | null>(null);
    const [voucherError, setVoucherError] = useState<string | null>(null);
    const [appliedVouchers, setAppliedVouchers] = useState<{ voucherId: string; code: string; amount: number }[]>([]);
    const voucherDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Refs for keyboard shortcuts ────────────────────────────────────
    const couponInputRef = useRef<HTMLInputElement>(null);
    const tenderAmountRef = useRef<HTMLInputElement>(null);
    const allianceDetailsRef = useRef<HTMLDetailsElement>(null);
    const allianceSearchRef = useRef<HTMLInputElement>(null);

    // ── Load cart ──────────────────────────────────────────────────────
    useEffect(() => {
        const raw = sessionStorage.getItem("pos_cart");
        if (!raw) { router.push("/pos/new-sale"); return; }
        const items: CartItem[] = JSON.parse(raw);

        const recalculatedItems = items.map(item => {
            const retailPrice = item.price;
            const taxDivisor = 1 + (item.taxPercent / 100);
            const wostPerUnit = retailPrice / taxDivisor;
            const totalWost = wostPerUnit * item.quantity;
            const discountPercent = item.overrideDiscountPercent ?? item.discountPercent;
            const discountAmount = Math.round(totalWost * (discountPercent / 100));
            const afterDiscount = totalWost - discountAmount;
            const taxAmount = Math.round(afterDiscount * (item.taxPercent / 100));
            const total = Math.round(afterDiscount + taxAmount);
            return { ...item, discountAmount, taxAmount, total };
        });

        setCartItems(recalculatedItems);
        setPromoScopedItems(new Set(recalculatedItems.map((i) => i.id)));
        const holdId = sessionStorage.getItem("pos_hold_order_id");
        if (holdId) setHoldOrderId(holdId);
    }, [router]);

    // ── Load config ────────────────────────────────────────────────────
    useEffect(() => {
        authFetch(`/pos-config/checkout-config`)
            .then((res) => {
                if (res.ok && res.data?.status) {
                    setPromos(res.data.data.promos ?? []);
                    setAlliances(res.data.data.alliances ?? []);
                }
            }).catch(() => { }).finally(() => setIsLoadingConfig(false));
    }, []);

    // ── Fetch customers ────────────────────────────────────────────────
    useEffect(() => {
        setIsLoadingCustomers(true);
        const searchParam = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : "";
        authFetch(`/pos-sales/customers${searchParam}`)
            .then(res => {
                if (res.ok && res.data?.status) setCustomers(res.data.data || []);
            })
            .catch(() => { })
            .finally(() => setIsLoadingCustomers(false));
    }, [customerSearch]);

    // ─── Derived totals ────────────────────────────────────────────────
    const subtotal = cartItems.reduce((acc, i) => {
        const taxDivisor = 1 + (i.taxPercent / 100);
        return acc + ((i.price / taxDivisor) * i.quantity);
    }, 0);

    const itemDiscounts = cartItems.reduce((acc, i) => {
        const taxDivisor = 1 + (i.taxPercent / 100);
        const wostPerUnit = i.price / taxDivisor;
        const totalWost = wostPerUnit * i.quantity;
        const discountPercent = i.overrideDiscountPercent ?? i.discountPercent;
        return acc + (totalWost * (discountPercent / 100));
    }, 0);

    const subtotalAfterItems = subtotal - itemDiscounts;

    let orderDiscount = 0;
    let finalItemDiscounts = itemDiscounts;

    if (discountMode === "alliance" && selectedAlliance) {
        let allianceDiscount = 0;
        const allianceBase = subtotal;
        if (selectedAlliance.maxDiscount) {
            allianceDiscount = Math.min(
                allianceBase * (Number(selectedAlliance.discountPercent) / 100),
                Number(selectedAlliance.maxDiscount)
            );
        } else {
            allianceDiscount = allianceBase * (Number(selectedAlliance.discountPercent) / 100);
        }
        allianceDiscount = Math.round(allianceDiscount * 100) / 100;

        if (allianceDiscount >= itemDiscounts) {
            orderDiscount = allianceDiscount;
            finalItemDiscounts = 0;
        } else {
            orderDiscount = 0;
            finalItemDiscounts = itemDiscounts;
        }
    } else if (discountMode === "promo" && selectedPromo) {
        const scopedSubtotal = promoScopeAll
            ? subtotalAfterItems
            : cartItems.filter(i => promoScopedItems.has(i.id)).reduce((acc, i) => acc + i.total, 0);
        orderDiscount = calcPromoDiscount(selectedPromo, scopedSubtotal);
    } else if (discountMode === "coupon" && appliedCoupon) {
        orderDiscount = appliedCoupon.discountAmount;
    } else if (discountMode === "manual") {
        if (manualDiscountType === "percent") {
            orderDiscount = Math.round(subtotalAfterItems * (manualDiscountValue / 100) * 100) / 100;
        } else {
            orderDiscount = Math.min(manualDiscountValue, subtotalAfterItems);
        }
    }

    const totalDiscount = finalItemDiscounts + orderDiscount;
    const isOrderDiscountApplied = (discountMode === "alliance" || discountMode === "coupon" || discountMode === "manual") && orderDiscount > 0;

    // Alliance/Coupon/Manual distribution per item (calculated first for use in tax)
    const allianceSharePerItem: number[] = [];
    if (isOrderDiscountApplied && cartItems.length > 0) {
        const base = subtotal > 0 ? subtotal : 1;
        let distributed = 0;
        const rawShares = cartItems.map(item => {
            const taxDivisor = 1 + (item.taxPercent / 100);
            const wostPerUnit = item.price / taxDivisor;
            const itemWost = wostPerUnit * item.quantity;
            const share = Math.floor(orderDiscount * itemWost / base);
            distributed += share;
            return share;
        });
        let remainder = Math.round(orderDiscount - distributed);
        const sortedIdx = cartItems
            .map((item, i) => {
                const taxDivisor = 1 + (item.taxPercent / 100);
                const wostPerUnit = item.price / taxDivisor;
                return { i, v: wostPerUnit * item.quantity };
            })
            .sort((a, b) => b.v - a.v)
            .map(x => x.i);
        for (let k = 0; k < remainder; k++) rawShares[sortedIdx[k % sortedIdx.length]]++;
        allianceSharePerItem.push(...rawShares);
    } else {
        cartItems.forEach(() => allianceSharePerItem.push(0));
    }

    let itemTax = 0;
    if (isOrderDiscountApplied) {
        cartItems.forEach((i, idx) => {
            const taxDivisor = 1 + (i.taxPercent / 100);
            const wostPerUnit = i.price / taxDivisor;
            const totalWost = wostPerUnit * i.quantity;
            const share = allianceSharePerItem[idx];
            const afterDiscount = totalWost - share;
            itemTax += Math.round(afterDiscount * (i.taxPercent / 100) * 100) / 100;
        });
    } else {
        itemTax = cartItems.reduce((acc, i) => {
            const taxDivisor = 1 + (i.taxPercent / 100);
            const wostPerUnit = i.price / taxDivisor;
            const totalWost = wostPerUnit * i.quantity;
            const discountPercent = i.overrideDiscountPercent ?? i.discountPercent;
            const discountAmount = totalWost * (discountPercent / 100);
            const afterDiscount = totalWost - discountAmount;
            return acc + (Math.round(afterDiscount * (i.taxPercent / 100) * 100) / 100);
        }, 0);
    }

    // Grand total includes FBR POS Fee
    const grandTotal = Math.round(Math.max(0, subtotal - totalDiscount + itemTax) + FBR_POS_FEE);
    const totalPaid = tenders.reduce((a, t) => a + t.amount, 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    const changeAmount = Math.max(0, totalPaid - grandTotal);

    // ── Helpers ────────────────────────────────────────────────────────
    const clearDiscount = useCallback(() => {
        setDiscountMode("none");
        setSelectedPromo(null);
        setSelectedAlliance(null);
        setAllianceMeta({ cardholderName: "", cardLast4: "", merchantSlip: "" });
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponError("");
        setManualDiscountValue(0);
        setShowPromoScope(false);
    }, []);

    const handleValidateCoupon = useCallback(async () => {
        if (!couponInput.trim()) return;
        setIsValidatingCoupon(true);
        setCouponError("");
        try {
            const res = await authFetch(
                "/pos-config/validate-coupon",
                { method: "POST", body: { code: couponInput.trim().toUpperCase(), orderSubtotal: subtotalAfterItems } }
            );
            if (res.ok && res.data?.status) {
                setAppliedCoupon(res.data.data);
                setDiscountMode("coupon");
                toast.success(`Coupon "${res.data.data.code}" — ${fmtCurrency(res.data.data.discountAmount)} off`);
            } else {
                setCouponError(res.data?.message || "Invalid coupon");
            }
        } catch { setCouponError("Failed to validate coupon"); }
        finally { setIsValidatingCoupon(false); }
    }, [couponInput, subtotalAfterItems]);

    const addTender = () => {
        if (!tenderAmount || tenderAmount <= 0) return;
        
        if (discountMode === "alliance" && selectedAlliance) {
            if (tenderMethod === "cash") {
                toast.error("Cash payment is not allowed when Alliance is selected.");
                return;
            }
            if (!tenderCardLast4 || tenderCardLast4.trim().length !== 4) {
                toast.error("Card number (last 4 digits) is mandatory when Alliance is selected.");
                return;
            }
        }

        // Merchant required for card / bank_transfer payments
        if ((tenderMethod === "card" || tenderMethod === "bank_transfer") && !selectedMerchant) {
            toast.error("Please select a merchant / bank terminal before adding a card payment.");
            return;
        }
        setTenders(prev => [...prev, {
            method: tenderMethod, amount: tenderAmount,
            cardLast4: tenderCardLast4 || undefined,
            slipNo: tenderSlip || undefined,
        }]);
        // When paying by card with an alliance selected, sync card details into allianceMeta
        if ((tenderMethod === "card" || tenderMethod === "bank_transfer") && discountMode === "alliance") {
            setAllianceMeta({
                cardholderName: tenderCardholderName,
                cardLast4: tenderCardLast4,
                merchantSlip: tenderSlip,
            });
        }
        setTenderAmount(0);
        setTenderCardholderName("");
        setTenderCardLast4("");
        setTenderSlip("");
    };

    const validateVoucherCode = useCallback(async (code: string) => {
        const trimmed = code.trim().toUpperCase();
        const validFormat = /^[A-Z]{3}-[A-Z0-9]{6}$/.test(trimmed);
        if (!validFormat) {
            setValidatedVoucher(null);
            setVoucherError(trimmed.length >= 4 ? "Invalid format — expected: ABC-123456" : null);
            return;
        }
        setVoucherValidating(true);
        setVoucherError(null);
        try {
            const locationId = getCookie("pos_location_id") || "";
            const res = await authFetch("/pos-config/vouchers/validate", {
                method: "POST",
                body: { code: trimmed, locationId, customerId: selectedCustomer?.id },
            });
            if (res.ok && res.data?.status) {
                setValidatedVoucher(res.data.data);
                setVoucherError(null);
                setTenderAmount(Math.min(res.data.data.faceValue, balanceDue));
            } else {
                setValidatedVoucher(null);
                setVoucherError(res.data?.message || "Invalid voucher");
            }
        } catch {
            setVoucherError("Failed to validate voucher");
        } finally {
            setVoucherValidating(false);
        }
    }, [selectedCustomer, balanceDue]);

    const handleVoucherCodeChange = (value: string) => {
        const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        let formatted = clean;
        if (clean.length > 3) formatted = `${clean.slice(0, 3)}-${clean.slice(3, 9)}`;
        setVoucherCode(formatted);
        setValidatedVoucher(null);
        setVoucherError(null);
        if (voucherDebounceRef.current) clearTimeout(voucherDebounceRef.current);
        if (formatted.length === 10) {
            voucherDebounceRef.current = setTimeout(() => validateVoucherCode(formatted), 400);
        }
    };

    const addVoucherTender = () => {
        if (!validatedVoucher || !tenderAmount || tenderAmount <= 0) return;
        if (appliedVouchers.some(v => v.voucherId === validatedVoucher.id)) {
            toast.error("This voucher is already added");
            return;
        }
        const amount = Math.min(tenderAmount, validatedVoucher.faceValue);
        setAppliedVouchers(prev => [...prev, { voucherId: validatedVoucher.id, code: validatedVoucher.code, amount }]);
        setTenders(prev => [...prev, { method: "voucher", amount, slipNo: validatedVoucher.code, voucherId: validatedVoucher.id }]);
        setVoucherCode("");
        setValidatedVoucher(null);
        setTenderAmount(0);
    };

    const removeTender = (i: number) => {
        const removed = tenders[i];
        if (removed.method === "voucher") {
            setAppliedVouchers(prev => prev.filter(v => v.code !== removed.slipNo && v.voucherId !== removed.voucherId));
        }
        setTenders(prev => prev.filter((_, j) => j !== i));
    };

    // ── Hold ───────────────────────────────────────────────────────────
    const handleHold = useCallback(async (holdUntilTime?: string) => {
        if (!holdUntilTime) { setShowHoldModal(true); return; }
        setIsHolding(true);
        try {
            const payload = {
                items: cartItems.map(item => ({
                    itemId: item.id, quantity: item.quantity, unitPrice: item.price,
                    discountPercent: item.discountPercent, taxPercent: item.taxPercent,
                    isStockInTransit: item.isStockInTransit || false,
                })),
            };
            const res = await authFetch("/pos-sales/orders/hold", { method: "POST", body: payload });
            if (res.ok && res.data?.status) {
                toast.success(res.data.message || "Order placed on hold");
                setShowHoldModal(false);
                router.push("/pos/new-sale");
            } else {
                toast.error(res.data?.message || "Failed to hold order");
            }
        } catch {
            toast.error("Failed to hold order. Check connection.");
        } finally {
            setIsHolding(false);
        }
    }, [cartItems, router]);

    // ── Confirm sale ───────────────────────────────────────────────────
    const handleConfirm = useCallback(async () => {
        if (balanceDue > 0) { toast.error("Balance due must be 0 before completing."); return; }
        if (settings.requireCustomer && !selectedCustomer) {
            toast.error("A customer must be selected to complete this sale.");
            return;
        }

        if (discountMode === "alliance" && selectedAlliance) {
            const hasCash = tenders.some(t => t.method === "cash");
            if (hasCash) {
                toast.error("Alliance discount cannot be applied when cash payment is selected.");
                return;
            }
            const activeCardLast4 = tenderCardLast4 || allianceMeta.cardLast4;
            if (!activeCardLast4 || activeCardLast4.trim().length !== 4) {
                toast.error("Card number (last 4 digits) is mandatory when Alliance is selected.");
                return;
            }
            const cardTender = tenders.find(t => t.method === "card");
            if (!cardTender) {
                toast.error("Please add the card payment to the payment list.");
                return;
            }
            if (!cardTender.cardLast4 || cardTender.cardLast4.trim().length !== 4) {
                toast.error("Card number (last 4 digits) is mandatory for card payments when Alliance is selected.");
                return;
            }
        }

        // Merchant required if any card / bank_transfer tender was added
        const hasCardTender = tenders.some(t => t.method === "card" || t.method === "bank_transfer");
        if (hasCardTender && !selectedMerchant) {
            toast.error("Please select a merchant / bank terminal for the card payment.");
            return;
        }
        setIsSubmitting(true);
        try {
            const orderItems = cartItems.map((item) => ({
                itemId: item.id, quantity: item.quantity, unitPrice: item.price,
                discountPercent: item.discountPercent,
                overrideDiscountPercent: item.overrideDiscountPercent,
                taxPercent: item.taxPercent,
                promoDiscountAmount:
                    (discountMode === "promo" && selectedPromo && !promoScopeAll && promoScopedItems.has(item.id))
                        ? Math.round(calcPromoDiscount(selectedPromo, item.total) / (promoScopedItems.size || 1))
                        : 0,
            }));

            const body: any = {
                items: orderItems,
                tenders: tenders.length > 0 ? tenders : [{ method: "cash", amount: grandTotal }],
                customerId: selectedCustomer?.id || null,
                isGiftReceipt,
                voucherRedemptions: appliedVouchers.length > 0 ? appliedVouchers : undefined,
                cashierUserId: selectedCashierId || null,
            };

            if (holdOrderId) body.holdOrderId = holdOrderId;

            if (discountMode === "promo" && selectedPromo) {
                body.promoId = selectedPromo.id;
                body.promoScope = promoScopeAll
                    ? { type: "order" }
                    : { type: "items", itemIds: [...promoScopedItems] };
            }
            if (discountMode === "coupon" && appliedCoupon) body.couponId = appliedCoupon.id;
            if (discountMode === "alliance" && selectedAlliance) {
                body.allianceId = selectedAlliance.id;
                body.allianceMeta = {
                    cardholderName: tenderCardholderName || allianceMeta.cardholderName,
                    cardLast4: tenderCardLast4 || allianceMeta.cardLast4,
                    merchantSlip: tenderSlip || allianceMeta.merchantSlip,
                };
            }
            if (discountMode === "manual" && orderDiscount > 0) {
                if (manualDiscountType === "percent") body.globalDiscountPercent = manualDiscountValue;
                else body.globalDiscountAmount = orderDiscount;
            }
            // Merchant (bank terminal) for card payments
            if (selectedMerchant && (tenders.some(t => t.method === "card" || t.method === "bank_transfer"))) {
                body.merchantId = selectedMerchant.id;
            }

            const res = await authFetch("/pos-sales/orders", { method: "POST", body });
            if (res.ok && res.data?.status) {
                setCompletedOrder(res.data.data);
                sessionStorage.removeItem("pos_cart");
                sessionStorage.removeItem("pos_hold_order_id");
            } else {
                toast.error(res.data?.message || "Checkout failed");
            }
        } catch { toast.error("Checkout failed. Check connection."); }
        finally { setIsSubmitting(false); }
    }, [
        cartItems, tenders, discountMode, selectedPromo, promoScopeAll, promoScopedItems,
        appliedCoupon, selectedAlliance, allianceMeta, manualDiscountType, manualDiscountValue,
        orderDiscount, grandTotal, balanceDue, selectedCustomer, selectedCashierId,
        isGiftReceipt, appliedVouchers, holdOrderId, settings.requireCustomer, selectedMerchant,
    ]);

    // ── Credit Sale ────────────────────────────────────────────────────
    const handleCreditSale = useCallback(async () => {
        if (!selectedCustomer) {
            toast.error("Please select a customer for credit sale.");
            return;
        }

        if (discountMode === "alliance" && selectedAlliance) {
            const hasCash = tenders.some(t => t.method === "cash");
            if (hasCash) {
                toast.error("Alliance discount cannot be applied when cash payment is selected.");
                return;
            }
            const activeCardLast4 = tenderCardLast4 || allianceMeta.cardLast4;
            if (!activeCardLast4 || activeCardLast4.trim().length !== 4) {
                toast.error("Card number (last 4 digits) is mandatory when Alliance is selected.");
                return;
            }
        }

        // Merchant required if any card / bank_transfer tender was added
        const hasCardTenderCredit = tenders.some(t => t.method === "card" || t.method === "bank_transfer");
        if (hasCardTenderCredit && !selectedMerchant) {
            toast.error("Please select a merchant / bank terminal for the card payment.");
            return;
        }
        if (!confirm(`Confirm credit sale of ${fmtCurrency(grandTotal)} to ${selectedCustomer.name}?\n\nBalance will be added to customer ledger.`)) return;

        setIsSubmitting(true);
        try {
            const orderItems = cartItems.map((item) => ({
                itemId: item.id, quantity: item.quantity, unitPrice: item.price,
                discountPercent: item.discountPercent,
                overrideDiscountPercent: item.overrideDiscountPercent,
                taxPercent: item.taxPercent,
                promoDiscountAmount:
                    (discountMode === "promo" && selectedPromo && !promoScopeAll && promoScopedItems.has(item.id))
                        ? Math.round(calcPromoDiscount(selectedPromo, item.total) / (promoScopedItems.size || 1))
                        : 0,
            }));

            const body: any = {
                items: orderItems,
                tenders: tenders.length > 0 ? tenders : [],
                customerId: selectedCustomer.id,
                isCreditSale: true,
                creditAmount: balanceDue,
                isGiftReceipt,
            };

            if (holdOrderId) body.holdOrderId = holdOrderId;

            if (discountMode === "promo" && selectedPromo) {
                body.promoId = selectedPromo.id;
                body.promoScope = promoScopeAll
                    ? { type: "order" }
                    : { type: "items", itemIds: [...promoScopedItems] };
            }
            if (discountMode === "coupon" && appliedCoupon) body.couponId = appliedCoupon.id;
            if (discountMode === "alliance" && selectedAlliance) {
                body.allianceId = selectedAlliance.id;
                body.allianceMeta = {
                    cardholderName: tenderCardholderName || allianceMeta.cardholderName,
                    cardLast4: tenderCardLast4 || allianceMeta.cardLast4,
                    merchantSlip: tenderSlip || allianceMeta.merchantSlip,
                };
            }
            if (discountMode === "manual" && orderDiscount > 0) {
                if (manualDiscountType === "percent") body.globalDiscountPercent = manualDiscountValue;
                else body.globalDiscountAmount = orderDiscount;
            }
            // Merchant (bank terminal) for card payments
            if (selectedMerchant && (tenders.some(t => t.method === "card" || t.method === "bank_transfer"))) {
                body.merchantId = selectedMerchant.id;
            }

            const res = await authFetch("/pos-sales/orders", { method: "POST", body });
            if (res.ok && res.data?.status) {
                toast.success(`Credit sale completed! Balance added to ${selectedCustomer.name}'s ledger.`);
                setCompletedOrder(res.data.data);
                sessionStorage.removeItem("pos_cart");
                sessionStorage.removeItem("pos_hold_order_id");
            } else {
                toast.error(res.data?.message || "Credit sale failed");
            }
        } catch { toast.error("Credit sale failed. Check connection."); }
        finally { setIsSubmitting(false); }
    }, [
        cartItems, tenders, discountMode, selectedPromo, promoScopeAll, promoScopedItems,
        appliedCoupon, selectedAlliance, allianceMeta, manualDiscountType, manualDiscountValue,
        orderDiscount, grandTotal, balanceDue, selectedCustomer, holdOrderId, isGiftReceipt,
        selectedMerchant,
    ]);

    // ── Keyboard shortcuts ────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

            if (e.key === "F2") {
                e.preventDefault();
                couponInputRef.current?.focus();
                couponInputRef.current?.closest("details")?.setAttribute("open", "");
            }
            if (e.key === "F3") {
                e.preventDefault();
                allianceDetailsRef.current?.setAttribute("open", "");
                setTimeout(() => allianceSearchRef.current?.focus(), 50);
            }
            if (e.key === "F4") { e.preventDefault(); tenderAmountRef.current?.focus(); }
            if (e.key === "F5") {
                e.preventDefault();
                setTenderAmount(balanceDue);
                tenderAmountRef.current?.focus();
            }
            if (e.key === "F12") {
                e.preventDefault();
                if (balanceDue <= 0 && !isSubmitting) handleConfirm();
            }
            if (e.key === "Escape" && !isInput) clearDiscount();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [balanceDue, isSubmitting, handleConfirm, clearDiscount]);

    // ════════════════════════════════════════════════════════════════════
    return (
        <>

            <div className="flex flex-col h-full gap-4">

                {/* Header */}
                <CheckoutHeader
                    cartItemCount={cartItems.length}
                    onBack={() => router.push("/pos/new-sale")}
                />

                {/* Add Customer Modal */}
                <AddCustomerModal
                    open={showAddCustomer}
                    onOpenChange={setShowAddCustomer}
                    onSuccess={(c) => {
                        setCustomers(prev => [c, ...prev]);
                        setSelectedCustomer(c);
                    }}
                />

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

                    {/* ── Left: Order Summary ──────────────────────────────────────── */}
                    <OrderSummary
                        cashiers={cashiers}
                        selectedCashierId={selectedCashierId}
                        isLoadingCashiers={isLoadingCashiers}
                        onCashierChange={setSelectedCashierId}
                        customers={customers}
                        selectedCustomer={selectedCustomer}
                        customerSearch={customerSearch}
                        isLoadingCustomers={isLoadingCustomers}
                        requireCustomer={settings.requireCustomer ?? false}
                        canAddCustomer={canAddCustomer}
                        onCustomerChange={(val) => {
                            if (val === "walk-in") setSelectedCustomer(null);
                            else {
                                const cust = customers.find(c => c.id === val);
                                if (cust) setSelectedCustomer(cust);
                            }
                        }}
                        onCustomerSearch={setCustomerSearch}
                        onAddCustomer={() => setShowAddCustomer(true)}
                        onClearCustomer={() => setSelectedCustomer(null)}
                        cartItems={cartItems}
                        discountMode={discountMode}
                        orderDiscount={orderDiscount}
                        allianceSharePerItem={allianceSharePerItem}
                        fmtCurrency={fmtCurrency}
                    />

                    {/* ── Mid: Discounts ────────────────────────────────────────────── */}
                    <DiscountPanel
                        discountMode={discountMode}
                        isLoadingConfig={isLoadingConfig}
                        canPromo={canPromo}
                        canCoupon={canCoupon}
                        canAlliance={canAlliance}
                        canManualDiscount={canManualDiscount}
                        tenders={tenders}
                        orderDiscount={orderDiscount}
                        itemDiscounts={itemDiscounts}
                        finalItemDiscounts={finalItemDiscounts}
                        subtotal={subtotal}
                        subtotalAfterItems={subtotalAfterItems}
                        cartItems={cartItems}
                        promos={promos}
                        selectedPromo={selectedPromo}
                        promoScopeAll={promoScopeAll}
                        promoScopedItems={promoScopedItems}
                        showPromoScope={showPromoScope}
                        onSelectPromo={(promo) => {
                            clearDiscount();
                            setSelectedPromo(promo);
                            setDiscountMode("promo");
                            setPromoScopeAll(true);
                            setPromoScopedItems(new Set(cartItems.map(i => i.id)));
                        }}
                        onSetPromoScopeAll={setPromoScopeAll}
                        onSetPromoScopedItems={setPromoScopedItems}
                        onTogglePromoScope={() => setShowPromoScope(v => !v)}
                        couponInput={couponInput}
                        couponError={couponError}
                        isValidatingCoupon={isValidatingCoupon}
                        appliedCoupon={appliedCoupon}
                        couponInputRef={couponInputRef}
                        onCouponInputChange={(val) => { setCouponInput(val); setCouponError(""); }}
                        onValidateCoupon={handleValidateCoupon}
                        alliances={alliances}
                        selectedAlliance={selectedAlliance}
                        allianceSearch={allianceSearch}
                        allianceDetailsRef={allianceDetailsRef}
                        allianceSearchRef={allianceSearchRef}
                        onAllianceSearch={setAllianceSearch}
                        onSelectAlliance={(a) => {
                            if (tenders.some(t => t.method === "cash")) {
                                toast.error("Alliance discount cannot be applied when cash payment is added.");
                                return;
                            }
                            clearDiscount();
                            setSelectedAlliance(a);
                            setDiscountMode("alliance");
                        }}
                        manualDiscountType={manualDiscountType}
                        manualDiscountValue={manualDiscountValue}
                        onManualDiscountTypeChange={setManualDiscountType}
                        onManualDiscountValueChange={(v) => {
                            setManualDiscountValue(v);
                            if (v > 0) setDiscountMode("manual");
                            else if (discountMode === "manual") setDiscountMode("none");
                        }}
                        onClearDiscount={clearDiscount}
                        fmtCurrency={fmtCurrency}
                        calcPromoDiscount={calcPromoDiscount}
                    />

                    {/* ── Right: Totals + Payment ───────────────────────────────────── */}
                    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-0.5">

                        {/* Totals */}
                        <TotalsPanel
                            cartItemCount={cartItems.length}
                            subtotal={subtotal}
                            finalItemDiscounts={finalItemDiscounts}
                            itemDiscounts={itemDiscounts}
                            discountMode={discountMode}
                            selectedPromo={selectedPromo}
                            appliedCoupon={appliedCoupon}
                            selectedAlliance={selectedAlliance}
                            orderDiscount={orderDiscount}
                            itemTax={itemTax}
                            fbrPosFee={FBR_POS_FEE}
                            grandTotal={grandTotal}
                            fmtCurrency={fmtCurrency}
                        />

                        {/* Payment */}
                        <PaymentPanel
                            tenders={tenders}
                            tenderMethod={tenderMethod}
                            tenderAmount={tenderAmount}
                            tenderCardholderName={tenderCardholderName}
                            tenderCardLast4={tenderCardLast4}
                            tenderSlip={tenderSlip}
                            balanceDue={balanceDue}
                            changeAmount={changeAmount}
                            discountMode={discountMode}
                            selectedAlliance={selectedAlliance}
                            selectedCustomer={selectedCustomer}
                            merchants={merchants}
                            selectedMerchant={selectedMerchant}
                            isLoadingMerchants={isLoadingMerchants}
                            onMerchantChange={setSelectedMerchant}
                            voucherCode={voucherCode}
                            validatedVoucher={validatedVoucher}
                            voucherError={voucherError}
                            voucherValidating={voucherValidating}
                            tenderAmountRef={tenderAmountRef}
                            onTenderMethodChange={setTenderMethod}
                            onTenderAmountChange={setTenderAmount}
                            onTenderCardholderNameChange={setTenderCardholderName}
                            onTenderCardLast4Change={setTenderCardLast4}
                            onTenderSlipChange={setTenderSlip}
                            onAddTender={addTender}
                            onAddVoucherTender={addVoucherTender}
                            onRemoveTender={removeTender}
                            onVoucherCodeChange={handleVoucherCodeChange}
                            onVoucherValidate={validateVoucherCode}
                            fmtCurrency={fmtCurrency}
                        />

                        {/* Action buttons */}
                        <ActionButtons
                            isSubmitting={isSubmitting}
                            isHolding={isHolding}
                            balanceDue={balanceDue}
                            changeAmount={changeAmount}
                            cartItemCount={cartItems.length}
                            selectedCustomer={selectedCustomer}
                            isGiftReceipt={isGiftReceipt}
                            canHold={canHold}
                            onGiftReceiptChange={setIsGiftReceipt}
                            onHold={() => handleHold()}
                            onCreditSale={handleCreditSale}
                            onPreviewReceipt={() => setShowReceiptPreview(true)}
                            onConfirm={handleConfirm}
                            fmtCurrency={fmtCurrency}
                        />
                    </div>
                </div>
            </div>

            {/* Receipt Preview Dialog */}
            {showReceiptPreview && (
                <PrintReceipt
                    order={{
                        orderNumber: "PREVIEW",
                        createdAt: new Date().toISOString(),
                        subtotal,
                        taxAmount: itemTax,
                        globalDiscountAmount: orderDiscount,
                        grandTotal,
                        fbrPosFee: FBR_POS_FEE,
                        changeAmount,
                        isGiftReceipt: false,
                        promo: selectedPromo ? { code: selectedPromo.code } : undefined,
                        coupon: appliedCoupon ? { code: appliedCoupon.code } : undefined,
                        alliance: selectedAlliance ? { code: selectedAlliance.code } : undefined,
                        cashierName: cashiers.find((c: any) => c.userId === selectedCashierId)?.name || "",
                    }}
                    cartItems={cartItems}
                    tenders={tenders.length > 0 ? tenders : [{ method: "cash", amount: grandTotal }]}
                    discountMode={discountMode}
                    selectedPromo={selectedPromo}
                    appliedCoupon={appliedCoupon}
                    selectedAlliance={selectedAlliance}
                    settings={settings}
                    onClose={() => setShowReceiptPreview(false)}
                />
            )}

            {/* Sale completed — show receipt */}
            {completedOrder && !showGiftReceiptAfterSales && (
                <PrintReceipt
                    order={{ ...completedOrder, fbrPosFee: FBR_POS_FEE, isGiftReceipt: false }}
                    cartItems={cartItems}
                    tenders={tenders}
                    discountMode={discountMode}
                    selectedPromo={selectedPromo}
                    appliedCoupon={appliedCoupon}
                    selectedAlliance={selectedAlliance}
                    settings={settings}
                    creditVouchers={completedOrder.creditVouchers}
                    onClose={() => {
                        if (isGiftReceipt) {
                            setShowGiftReceiptAfterSales(true);
                        } else {
                            setCompletedOrder(null);
                            router.push("/pos/new-sale");
                        }
                    }}
                />
            )}

            {/* Gift receipt */}
            {completedOrder && showGiftReceiptAfterSales && (
                <PrintReceipt
                    order={{ ...completedOrder, fbrPosFee: FBR_POS_FEE, isGiftReceipt: true }}
                    cartItems={cartItems}
                    tenders={tenders}
                    discountMode={discountMode}
                    selectedPromo={selectedPromo}
                    appliedCoupon={appliedCoupon}
                    selectedAlliance={selectedAlliance}
                    settings={settings}
                    creditVouchers={completedOrder.creditVouchers}
                    onClose={() => {
                        setCompletedOrder(null);
                        setShowGiftReceiptAfterSales(false);
                        router.push("/pos/new-sale");
                    }}
                />
            )}

            {/* Hold Order Modal */}
            <HoldOrderModal
                open={showHoldModal}
                onOpenChange={setShowHoldModal}
                onConfirm={handleHold}
                isHolding={isHolding}
                itemCount={cartItems.length}
            />
        </>
    );
}
