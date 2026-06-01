"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeft, Loader2, Tag, TicketPercent, Handshake, CheckCircle2,
    XCircle, Search, ShoppingCart, Printer, Trash2, Plus, Percent,
    BadgeDollarSign, CreditCard, Banknote, Wallet, Building2, Ticket,
    ChevronDown, ChevronUp, BookOpen, PauseCircle, UserRound, Receipt,
} from "lucide-react";
import type { CartItem } from "@/components/pos/new-sale/cart-table";
import { cn, getCookie, formatCurrency } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { HoldOrderModal } from "@/components/pos/hold-order-modal";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";

// ─── Types ──────────────────────────────────────────────────────────────
interface PromoConfig {
    id: string; name: string; code: string;
    type: "percent" | "fixed" | "buy_x_get_y";
    value: number; minOrderAmount?: number; maxDiscount?: number;
    startDate: string; endDate: string;
}
interface AllianceConfig {
    id: string; partnerName: string; code: string;
    discountPercent: number; maxDiscount?: number; description?: string;
    /** BIN prefixes (4–8 digits) that qualify for this alliance */
    binNumbers: string[];
}
interface AppliedCoupon {
    id: string; code: string; discountType: string;
    discountValue: number; discountAmount: number; description?: string;
}
interface Tender { method: string; amount: number; cardLast4?: string; slipNo?: string; }
interface Customer { id: string; name: string; code: string; contactNo?: string; address?: string; }
type DiscountMode = "none" | "promo" | "coupon" | "alliance" | "manual";

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

const TENDER_OPTIONS = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card", icon: CreditCard },
    { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
    { value: "voucher", label: "Voucher", icon: Ticket },
    { value: "credit_account", label: "Credit Account", icon: BookOpen },
];

// ─── Print Receipt ───────────────────────────────────────────────────────
// Imported from shared component — inline version removed, use PrintReceipt from @/components/pos/print-receipt

// ─── Customer Selection ──────────────────────────────────────────────────
function AddCustomerModal({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: (customer: Customer) => void }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: "", contactNo: "", email: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) { toast.error("Name is required"); return; }
        setIsSubmitting(true);
        try {
            // Generate a code if backend requires one and doesn't auto-gen
            const code = `CUST-${Date.now()}`;
            const res = await authFetch(
                "/pos-sales/customers",
                { method: "POST", body: { ...formData, code } }
            );
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
export default function CheckoutPage() {
    const router = useRouter();
    const { settings } = usePosSettings();
    const { hasPermission } = useAuth();
    const canPromo = hasPermission('pos.checkout.promo');
    const canCoupon = hasPermission('pos.checkout.coupon');
    const canAlliance = hasPermission('pos.checkout.alliance');
    const canManualDiscount = hasPermission('pos.checkout.manual-discount');
    const canAddCustomer = hasPermission('pos.checkout.add-customer');
    const canHold = hasPermission('pos.hold.create');
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [promos, setPromos] = useState<PromoConfig[]>([]);
    const [alliances, setAlliances] = useState<AllianceConfig[]>([]);
    const [allianceSearch, setAllianceSearch] = useState("");
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const { user } = useAuth();

    // ── Cashier state ──────────────────────────────────────────────────
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [selectedCashierId, setSelectedCashierId] = useState<string>("");
    const [isLoadingCashiers, setIsLoadingCashiers] = useState(false);

    // Load selected cashier from session storage
    useEffect(() => {
        const saved = sessionStorage.getItem("pos_selected_cashier_id");
        if (saved) setSelectedCashierId(saved);
    }, []);

    // Save selected cashier to session storage
    useEffect(() => {
        if (selectedCashierId) {
            sessionStorage.setItem("pos_selected_cashier_id", selectedCashierId);
        }
    }, [selectedCashierId]);

    // Fetch cashiers for the current location
    useEffect(() => {
        setIsLoadingCashiers(true);
        authFetch(`/pos-sales/cashiers`)
            .then(res => {
                if (res.ok && res.data?.status) {
                    const list = res.data.data || [];
                    setCashiers(list);
                    // Pre-select current user if they are in the list and nothing is saved
                    if (!sessionStorage.getItem("pos_selected_cashier_id") && user?.id) {
                        if (list.some((c: any) => c.userId === user.id)) {
                            setSelectedCashierId(user.id);
                        }
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

    // Apply default payment method from settings once loaded
    useEffect(() => {
        if (settings.defaultPaymentMethod) {
            setTenderMethod(settings.defaultPaymentMethod);
        }
    }, [settings.defaultPaymentMethod]);
    
    // Force card payment when alliance is selected
    useEffect(() => {
        if (discountMode === "alliance" && selectedAlliance) {
            setTenderMethod("card");
        }
    }, [discountMode, selectedAlliance]);
    
    const [tenderAmount, setTenderAmount] = useState<number>(0);
    const [tenderCardLast4, setTenderCardLast4] = useState("");
    const [tenderSlip, setTenderSlip] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<any>(null);
    const [isGiftReceipt, setIsGiftReceipt] = useState(false);
    // When isGiftReceipt is true and sale completes, we show both receipts sequentially
    const [showGiftReceiptAfterSales, setShowGiftReceiptAfterSales] = useState(false);
    // Receipt preview state
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
    // Track vouchers added as tenders: { voucherId, code, amount }
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
        
        // Recalculate all items with correct WOST-based formula
        const recalculatedItems = items.map(item => {
            // Step 1: Retail price
            const retailPrice = item.price;
            
            // Step 2: Calculate WOST
            const taxDivisor = 1 + (item.taxPercent / 100);
            const wostPerUnit = retailPrice / taxDivisor;
            const totalWost = wostPerUnit * item.quantity;
            
            // Step 3: Apply discount on WOST
            const discountPercent = item.overrideDiscountPercent ?? item.discountPercent;
            const discountAmount = Math.round(totalWost * (discountPercent / 100));
            const afterDiscount = totalWost - discountAmount;
            
            // Step 4: Calculate tax on discounted amount
            const taxAmount = Math.round(afterDiscount * (item.taxPercent / 100));
            
            // Step 5: Total
            const total = afterDiscount + taxAmount;
            
            return {
                ...item,
                discountAmount,
                taxAmount,
                total
            };
        });
        
        setCartItems(recalculatedItems);
        setPromoScopedItems(new Set(recalculatedItems.map((i) => i.id)));
        // Restore hold order ID if resuming from hold
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
        const searchParam = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : '';
        authFetch(`/pos-sales/customers${searchParam}`)
            .then(res => {
                if (res.ok && res.data?.status) setCustomers(res.data.data || []);
            })
            .catch(() => { })
            .finally(() => setIsLoadingCustomers(false));
    }, [customerSearch]);


    // ─── Derived totals ────────────────────────────────────────────────
    // Calculate subtotal as sum of WOST (Value Without Sales Tax) for all items
    const subtotal = cartItems.reduce((acc, i) => {
        const taxDivisor = 1 + (i.taxPercent / 100);
        const wostPerUnit = i.price / taxDivisor;
        return acc + (wostPerUnit * i.quantity);
    }, 0);
    
    // Recalculate item discounts from WOST (not using stored i.discountAmount)
    const itemDiscounts = cartItems.reduce((acc, i) => {
        const taxDivisor = 1 + (i.taxPercent / 100);
        const wostPerUnit = i.price / taxDivisor;
        const totalWost = wostPerUnit * i.quantity;
        const discountPercent = i.overrideDiscountPercent ?? i.discountPercent;
        const discountAmount = Math.round(totalWost * (discountPercent / 100));
        return acc + discountAmount;
    }, 0);
    
    const subtotalAfterItems = subtotal - itemDiscounts;

    let orderDiscount = 0;
    // finalItemDiscounts: item-level discounts that will actually be applied.
    // When alliance wins the comparison, this is zeroed out so only one discount applies.
    let finalItemDiscounts = itemDiscounts;

    if (discountMode === "alliance" && selectedAlliance) {
        // Alliance discount applies on the pre-tax subtotal (excl. item-level discounts).
        // If maxDiscount is set it acts as a fixed cap; otherwise use the percentage.
        let allianceDiscount = 0;
        const allianceBase = subtotalAfterItems; // pre-tax, after item discounts
        if (selectedAlliance.maxDiscount) {
            allianceDiscount = Math.min(
                Math.round(allianceBase * (Number(selectedAlliance.discountPercent) / 100)),
                Number(selectedAlliance.maxDiscount)
            );
        } else {
            allianceDiscount = Math.round(allianceBase * (Number(selectedAlliance.discountPercent) / 100));
        }

        // Alliance wins when it's >= item discounts (equal → alliance preferred)
        if (allianceDiscount >= itemDiscounts) {
            orderDiscount = allianceDiscount;
            finalItemDiscounts = 0; // suppress item discounts — alliance is more beneficial
        } else {
            // Item discounts are strictly greater — keep them, alliance gives nothing extra
            orderDiscount = 0;
            finalItemDiscounts = itemDiscounts;
        }
    } else if (discountMode === "promo" && selectedPromo) {
        // Promo discount
        const scopedSubtotal = promoScopeAll
            ? subtotalAfterItems
            : cartItems.filter(i => promoScopedItems.has(i.id))
                .reduce((acc, i) => acc + (i.total), 0);
        orderDiscount = calcPromoDiscount(selectedPromo, scopedSubtotal);
    } else if (discountMode === "coupon" && appliedCoupon) {
        // Coupon discount
        orderDiscount = appliedCoupon.discountAmount;
    } else if (discountMode === "manual") {
        // Manual discount
        if (manualDiscountType === "percent") {
            orderDiscount = Math.round(subtotalAfterItems * (manualDiscountValue / 100));
        } else {
            orderDiscount = Math.min(manualDiscountValue, subtotalAfterItems);
        }
    }

    const totalDiscount = finalItemDiscounts + orderDiscount;
    
    // Recalculate item tax based on whether alliance/coupon is applied
    // When alliance/coupon is applied, tax is calculated on (WOST - alliance share)
    // Otherwise, tax is calculated on (WOST - item discount)
    const isOrderDiscountApplied = (discountMode === "alliance" || discountMode === "coupon") && orderDiscount > 0;
    
    let itemTax = 0;
    if (isOrderDiscountApplied) {
        // Calculate alliance/coupon share per item first
        const base = subtotal > 0 ? subtotal : 1;
        cartItems.forEach((i) => {
            const taxDivisor = 1 + (i.taxPercent / 100);
            const wostPerUnit = i.price / taxDivisor;
            const totalWost = wostPerUnit * i.quantity;
            // Proportional share of order discount
            const share = Math.round(orderDiscount * totalWost / base);
            const afterDiscount = totalWost - share;
            const taxAmount = Math.round(afterDiscount * (i.taxPercent / 100));
            itemTax += taxAmount;
        });
    } else {
        // Use item-level discounts
        itemTax = cartItems.reduce((acc, i) => {
            const taxDivisor = 1 + (i.taxPercent / 100);
            const wostPerUnit = i.price / taxDivisor;
            const totalWost = wostPerUnit * i.quantity;
            const discountPercent = i.overrideDiscountPercent ?? i.discountPercent;
            const discountAmount = Math.round(totalWost * (discountPercent / 100));
            const afterDiscount = totalWost - discountAmount;
            const taxAmount = Math.round(afterDiscount * (i.taxPercent / 100));
            return acc + taxAmount;
        }, 0);
    }

    // Alliance/Coupon distribution for display — proportional by item WOST value
    // Each item gets: floor(orderDiscount × itemWOST / totalWOST)
    // Remainder (from flooring) is distributed 1 unit at a time to the highest-value items.
    const allianceSharePerItem: number[] = [];
    if ((discountMode === "alliance" || discountMode === "coupon") && orderDiscount > 0 && cartItems.length > 0) {
        const base = subtotal > 0 ? subtotal : 1; // Use total WOST as base
        let distributed = 0;
        const rawShares = cartItems.map(item => {
            // Calculate item's WOST
            const taxDivisor = 1 + (item.taxPercent / 100);
            const wostPerUnit = item.price / taxDivisor;
            const itemWost = wostPerUnit * item.quantity;
            const share = Math.floor(orderDiscount * itemWost / base);
            distributed += share;
            return share;
        });
        let remainder = orderDiscount - distributed;
        // Sort indices by descending WOST value to give remainder to biggest items first
        const sortedIdx = cartItems
            .map((item, i) => {
                const taxDivisor = 1 + (item.taxPercent / 100);
                const wostPerUnit = item.price / taxDivisor;
                return { i, v: wostPerUnit * item.quantity };
            })
            .sort((a, b) => b.v - a.v)
            .map(x => x.i);
        for (let k = 0; k < remainder; k++) {
            rawShares[sortedIdx[k % sortedIdx.length]]++;
        }
        allianceSharePerItem.push(...rawShares);
    } else {
        cartItems.forEach(() => allianceSharePerItem.push(0));
    }
    const grandTotal = Math.max(0, subtotal - totalDiscount + itemTax);
    const totalPaid = tenders.reduce((a, t) => a + t.amount, 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    const changeAmount = Math.max(0, totalPaid - grandTotal);

    // ── Helpers ────────────────────────────────────────────────────────
    const clearDiscount = () => {
        setDiscountMode("none");
        setSelectedPromo(null);
        setSelectedAlliance(null);
        setAllianceMeta({ cardholderName: "", cardLast4: "", merchantSlip: "" });
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponError("");
        setManualDiscountValue(0);
        setShowPromoScope(false);
    };

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
        setTenders(prev => [...prev, {
            method: tenderMethod,
            amount: tenderAmount,
            cardLast4: tenderCardLast4 || undefined,
            slipNo: tenderSlip || undefined,
        }]);
        setTenderAmount(0);
        setTenderCardLast4("");
        setTenderSlip("");
    };

    // ── Voucher code validation (debounced) ────────────────────────────
    const validateVoucherCode = useCallback(async (code: string) => {
        const trimmed = code.trim().toUpperCase();
        // Format: 3-letter prefix + dash + 6 alphanumeric chars (e.g. GFT-ABC123)
        const validFormat = /^[A-Z]{3}-[A-Z0-9]{6}$/.test(trimmed);
        if (!validFormat) {
            setValidatedVoucher(null);
            // Only show format error if they've typed enough to be clearly wrong
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
                // Auto-fill amount = min(faceValue, balanceDue)
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
        // Strip everything except letters and digits, then uppercase
        const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

        // Auto-format: first 3 chars are the prefix, rest is the suffix
        // Result shape: "GFT-ABC123" (max 10 visible chars = 3 + dash + 6)
        let formatted = clean;
        if (clean.length > 3) {
            formatted = `${clean.slice(0, 3)}-${clean.slice(3, 9)}`;
        }

        setVoucherCode(formatted);
        setValidatedVoucher(null);
        setVoucherError(null);
        if (voucherDebounceRef.current) clearTimeout(voucherDebounceRef.current);

        // Fire API only when full 10-char code is present (XXX-XXXXXX)
        if (formatted.length === 10) {
            voucherDebounceRef.current = setTimeout(() => validateVoucherCode(formatted), 400);
        }
    };

    const addVoucherTender = () => {
        if (!validatedVoucher || !tenderAmount || tenderAmount <= 0) return;
        // Check not already applied
        if (appliedVouchers.some(v => v.voucherId === validatedVoucher.id)) {
            toast.error("This voucher is already added");
            return;
        }
        const amount = Math.min(tenderAmount, validatedVoucher.faceValue);
        setAppliedVouchers(prev => [...prev, { voucherId: validatedVoucher.id, code: validatedVoucher.code, amount }]);
        setTenders(prev => [...prev, { method: "voucher", amount, slipNo: validatedVoucher.code }]);
        setVoucherCode("");
        setValidatedVoucher(null);
        setTenderAmount(0);
    };

    // ── Submit order ───────────────────────────────────────────────────
    const handleHold = useCallback(async (holdUntilTime?: string) => {
        if (!holdUntilTime) { setShowHoldModal(true); return; }
        setIsHolding(true);
        try {
            const payload = {
                items: cartItems.map(item => ({
                    itemId: item.id,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    discountPercent: item.discountPercent,
                    taxPercent: item.taxPercent,
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

    const handleConfirm = useCallback(async () => {
        if (balanceDue > 0) { toast.error("Balance due must be 0 before completing."); return; }
        if (settings.requireCustomer && !selectedCustomer) {
            toast.error("A customer must be selected to complete this sale.");
            return;
        }
        setIsSubmitting(true);
        try {
            const orderItems = cartItems.map((item) => ({
                itemId: item.id,
                quantity: item.quantity,
                unitPrice: item.price,
                discountPercent: item.discountPercent,
                overrideDiscountPercent: item.overrideDiscountPercent,
                taxPercent: item.taxPercent,
                promoDiscountAmount: (discountMode === "promo" && selectedPromo && !promoScopeAll && promoScopedItems.has(item.id))
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

            // If resuming from a hold order, pass holdOrderId to skip double stock deduction
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
                if (allianceMeta.cardholderName || allianceMeta.cardLast4 || allianceMeta.merchantSlip) {
                    body.allianceMeta = allianceMeta;
                }
            }
            if (discountMode === "manual" && orderDiscount > 0) {
                if (manualDiscountType === "percent") body.globalDiscountPercent = manualDiscountValue;
                else body.globalDiscountAmount = orderDiscount;
            }

            const res = await authFetch(
                "/pos-sales/orders", { method: "POST", body }
            );

            if (res.ok && res.data?.status) {
                setCompletedOrder(res.data.data);
                sessionStorage.removeItem("pos_cart");
                sessionStorage.removeItem("pos_hold_order_id");
            } else {
                toast.error(res.data?.message || "Checkout failed");
            }
        } catch { toast.error("Checkout failed. Check connection."); }
        finally { setIsSubmitting(false); }
    }, [cartItems, tenders, discountMode, selectedPromo, promoScopeAll, promoScopedItems,
        appliedCoupon, selectedAlliance, allianceMeta, manualDiscountType, manualDiscountValue,
        orderDiscount, grandTotal, balanceDue]);

    // ─── Credit Sale Handler ───────────────────────────────────────────
    const handleCreditSale = useCallback(async () => {
        if (!selectedCustomer) {
            toast.error("Please select a customer for credit sale.");
            return;
        }
        
        if (!confirm(`Confirm credit sale of ${formatCurrency(grandTotal)} to ${selectedCustomer.name}?\n\nBalance will be added to customer ledger.`)) {
            return;
        }

        setIsSubmitting(true);
        try {
            const orderItems = cartItems.map((item) => ({
                itemId: item.id,
                quantity: item.quantity,
                unitPrice: item.price,
                discountPercent: item.discountPercent,
                overrideDiscountPercent: item.overrideDiscountPercent,
                taxPercent: item.taxPercent,
                promoDiscountAmount: (discountMode === "promo" && selectedPromo && !promoScopeAll && promoScopedItems.has(item.id))
                    ? Math.round(calcPromoDiscount(selectedPromo, item.total) / (promoScopedItems.size || 1))
                    : 0,
            }));

            const body: any = {
                items: orderItems,
                tenders: tenders.length > 0 ? tenders : [], // No payment for credit sale
                customerId: selectedCustomer.id,
                isCreditSale: true, // Flag for backend
                creditAmount: balanceDue, // Unpaid amount
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
                if (allianceMeta.cardholderName || allianceMeta.cardLast4 || allianceMeta.merchantSlip) {
                    body.allianceMeta = allianceMeta;
                }
            }
            if (discountMode === "manual" && orderDiscount > 0) {
                if (manualDiscountType === "percent") body.globalDiscountPercent = manualDiscountValue;
                else body.globalDiscountAmount = orderDiscount;
            }

            const res = await authFetch(
                "/pos-sales/orders", { method: "POST", body }
            );

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
    }, [cartItems, tenders, discountMode, selectedPromo, promoScopeAll, promoScopedItems,
        appliedCoupon, selectedAlliance, allianceMeta, manualDiscountType, manualDiscountValue,
        orderDiscount, grandTotal, balanceDue, selectedCustomer, holdOrderId]);

    const filteredAlliances = alliances.filter(
        (a) => a.partnerName.toLowerCase().includes(allianceSearch.toLowerCase()) ||
            a.code.toLowerCase().includes(allianceSearch.toLowerCase()) ||
            // BIN search: if the search looks like digits, match against stored BINs by prefix
            (allianceSearch.match(/^\d+/) && a.binNumbers.some(bin => bin.startsWith(allianceSearch.trim())))
    );

    // ── Keyboard shortcuts (placed after all derived values + callbacks) ─────────
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
            if (e.key === "F4") {
                e.preventDefault();
                tenderAmountRef.current?.focus();
            }
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
            {/* Print-only styles */}
            <style>{`@media print { body > * { display: none; } #receipt-content, #receipt-content * { display: block !important; } }`}</style>

            <div className="flex flex-col h-full gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/pos/new-sale")} className="gap-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Cart
                    </Button>
                    <h1 className="text-xl font-bold tracking-tight">Checkout</h1>
                    <div className="ml-auto flex items-center gap-2">
                        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-md px-2 py-1 bg-muted/30">
                            <kbd className="px-1 bg-background border rounded text-[10px]">F2</kbd><span>Coupon</span>
                            <span className="mx-1 opacity-30">|</span>
                            <kbd className="px-1 bg-background border rounded text-[10px]">F3</kbd><span>Alliance</span>
                            <span className="mx-1 opacity-30">|</span>
                            <kbd className="px-1 bg-background border rounded text-[10px]">F4</kbd><span>Pay</span>
                            <span className="mx-1 opacity-30">|</span>
                            <kbd className="px-1 bg-background border rounded text-[10px]">F5</kbd><span>Fill</span>
                            <span className="mx-1 opacity-30">|</span>
                            <kbd className="px-1 bg-background border rounded text-[10px]">F12</kbd><span>Complete</span>
                        </div>
                        <Badge variant="outline" className="font-mono">
                            {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
                        </Badge>
                    </div>
                </div>

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
                    <div className="rounded-xl border bg-card flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">Order Summary</span>
                        </div>

                        {/* Cashier Selection */}
                        <div className="px-4 py-4 border-b space-y-3 bg-muted/5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <UserRound className="h-3 w-3" /> Cashier / Employee
                            </Label>
                            <Select
                                value={selectedCashierId}
                                onValueChange={setSelectedCashierId}
                            >
                                <SelectTrigger className="w-full bg-muted/20 border-none h-10 px-3 font-medium">
                                    <SelectValue placeholder={isLoadingCashiers ? "Loading cashiers..." : "Select Cashier"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {isLoadingCashiers ? (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Loading...
                                        </div>
                                    ) : cashiers.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            No cashiers found for this location
                                        </div>
                                    ) : (
                                        cashiers.map(c => (
                                            <SelectItem key={c.userId} value={c.userId}>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{c.name}</span>
                                                    <span className="text-[10px] opacity-70 font-mono">{c.empCode} · {c.email}</span>
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Customer Section */}
                        <div className="px-4 py-4 border-b space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Customer{settings.requireCustomer && <span className="text-destructive ml-1">*</span>}
                        </Label>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Select
                                        value={selectedCustomer?.id || "walk-in"}
                                        onValueChange={(val) => {
                                            if (val === "walk-in") setSelectedCustomer(null);
                                            else {
                                                const cust = customers.find(c => c.id === val);
                                                if (cust) setSelectedCustomer(cust);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-full bg-muted/20 border-none h-10 px-3">
                                            <SelectValue placeholder="Select Customer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <div className="p-2 border-b">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Search customers..."
                                                        className="pl-8 h-8 text-xs"
                                                        value={customerSearch}
                                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                                            {isLoadingCustomers ? (
                                                <div className="p-4 text-center text-xs text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Loading...
                                                </div>
                                            ) : (
                                                customers.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{c.name}</span>
                                                            <span className="text-[10px] opacity-70">{c.contactNo || c.code}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0 bg-muted/20 border-none hover:bg-muted/40"
                                    disabled={!canAddCustomer}
                                    onClick={() => setShowAddCustomer(true)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {selectedCustomer && (
                                <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 animate-in fade-in slide-in-from-top-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-emerald-500 leading-none">{selectedCustomer.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 truncate">{selectedCustomer.contactNo || "No contact"} · {selectedCustomer.code}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedCustomer(null)}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="divide-y">
                                {cartItems.map((item, idx) => {
                                    const isOrderDiscountApplied = (discountMode === "alliance" || discountMode === "coupon") && orderDiscount > 0;
                                    const orderDiscountShare = isOrderDiscountApplied ? allianceSharePerItem[idx] : 0;
                                    
                                    // Calculate breakdown for display (same as receipt)
                                    const retailPrice = item.price;
                                    const taxDivisor = 1 + (item.taxPercent / 100);
                                    const wostPerUnit = retailPrice / taxDivisor;
                                    const totalWost = wostPerUnit * item.quantity;
                                    
                                    // When alliance/coupon is applied, item discounts are suppressed
                                    const showItemDiscount = !isOrderDiscountApplied && (item.overrideDiscountPercent ?? item.discountPercent) > 0;
                                    const discountPercent = item.overrideDiscountPercent ?? item.discountPercent;
                                    const calculatedDiscount = showItemDiscount ? Math.round(totalWost * (discountPercent / 100)) : 0;
                                    
                                    // Apply either order discount share or item discount
                                    const finalDiscount = isOrderDiscountApplied ? orderDiscountShare : calculatedDiscount;
                                    const afterDiscount = totalWost - finalDiscount;
                                    
                                    // Recalculate tax from discounted amount
                                    const calculatedTax = Math.round(afterDiscount * (item.taxPercent / 100));
                                    const calculatedTotal = afterDiscount + calculatedTax;
                                    
                                    return (
                                        <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">{item.sku} · {item.brand}</p>
                                                
                                                {/* Detailed Breakdown */}
                                                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground font-mono">
                                                    <div className="flex justify-between">
                                                        <span>Retail:</span>
                                                        <span>{item.quantity} × {fmtCurrency(retailPrice)} = {fmtCurrency(retailPrice * item.quantity)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>WOST:</span>
                                                        <span>{fmtCurrency(wostPerUnit)} × {item.quantity} = {fmtCurrency(totalWost)}</span>
                                                    </div>
                                                    {finalDiscount > 0 && (
                                                        <div className="flex justify-between text-destructive">
                                                            <span>
                                                                Discount {isOrderDiscountApplied 
                                                                    ? `(${discountMode === 'alliance' ? 'Alliance' : 'Coupon'})`
                                                                    : `${discountPercent}%`
                                                                }:
                                                            </span>
                                                            <span>−{fmtCurrency(finalDiscount)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between">
                                                        <span>After Discount:</span>
                                                        <span>{fmtCurrency(afterDiscount)}</span>
                                                    </div>
                                                    {item.taxPercent > 0 && (
                                                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                                            <span>Tax {item.taxPercent}%:</span>
                                                            <span>+{fmtCurrency(calculatedTax)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between font-semibold text-foreground border-t pt-0.5 mt-0.5">
                                                        <span>Total:</span>
                                                        <span>{fmtCurrency(calculatedTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* ── Mid: Discounts ────────────────────────────────────────────── */}
                    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-0.5">

                        {/* Active discount chip */}
                        {discountMode !== "none" && orderDiscount > 0 && (
                            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                <div className="flex-1 text-sm">
                                    <span className="font-medium">
                                        {discountMode === "promo" && selectedPromo?.name}
                                        {discountMode === "coupon" && `Coupon: ${appliedCoupon?.code}`}
                                        {discountMode === "alliance" && selectedAlliance?.partnerName}
                                        {discountMode === "manual" && "Manual Discount"}
                                    </span>
                                    <span className="text-muted-foreground ml-2 font-mono">−{fmtCurrency(orderDiscount)}</span>
                                    {discountMode === "alliance" && finalItemDiscounts === 0 && itemDiscounts > 0 && (
                                        <span className="text-xs text-muted-foreground ml-2">(replaces item discounts)</span>
                                    )}
                                </div>
                                <button onClick={clearDiscount} className="text-muted-foreground hover:text-foreground">
                                    <XCircle className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                        {/* Info chip when alliance is selected but item discounts are kept (item discounts > alliance) */}
                        {discountMode === "alliance" && selectedAlliance && orderDiscount === 0 && itemDiscounts > 0 && (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
                                <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                <div className="flex-1 text-sm">
                                    <span className="font-medium text-amber-700 dark:text-amber-400">{selectedAlliance.partnerName}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        Item discounts ({fmtCurrency(itemDiscounts)}) are more beneficial — alliance not applied
                                    </span>
                                </div>
                                <button onClick={clearDiscount} className="text-muted-foreground hover:text-foreground">
                                    <XCircle className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* Discount accordion */}
                        <div className="rounded-xl border bg-card overflow-hidden">

                            {/* ── Promos ── */}
                            {canPromo && (
                            <details className={cn("group", discountMode !== "none" && discountMode !== "promo" && "opacity-50 pointer-events-none")} open>
                                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors border-b">
                                    <Tag className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm flex-1">Promo Campaigns</span>
                                    {selectedPromo && <Badge variant="secondary" className="text-xs">{selectedPromo.code}</Badge>}
                                    {discountMode !== "none" && discountMode !== "promo" && (
                                        <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                                    )}
                                </summary>
                                <div className="p-3">
                                    {isLoadingConfig ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                        </div>
                                    ) : promos.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic py-2">No active promos for this location.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="max-h-[200px] overflow-y-auto">
                                                <div className="space-y-2 pr-1">
                                                    {promos.map((promo) => {
                                                        const discount = calcPromoDiscount(promo, subtotalAfterItems);
                                                        const isSelected = selectedPromo?.id === promo.id && discountMode === "promo";
                                                        const disabled = discountMode !== "none" && !isSelected;
                                                        return (
                                                            <div key={promo.id}>
                                                                <button
                                                                    disabled={disabled}
                                                                    onClick={() => {
                                                                        if (isSelected) { clearDiscount(); return; }
                                                                        clearDiscount();
                                                                        setSelectedPromo(promo);
                                                                        setDiscountMode("promo");
                                                                        setPromoScopeAll(true);
                                                                        setPromoScopedItems(new Set(cartItems.map(i => i.id)));
                                                                    }}
                                                                    className={cn(
                                                                        "w-full text-left rounded-lg border px-3 py-2 transition-all text-sm",
                                                                        isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-muted-foreground",
                                                                        disabled && "opacity-40 cursor-not-allowed"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <p className="font-semibold">{promo.name}</p>
                                                                            <p className="text-xs text-muted-foreground font-mono">{promo.code}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="font-bold text-primary font-mono">−{fmtCurrency(discount)}</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {promo.type === "percent" ? `${promo.value}%` : promo.type === "fixed" ? `Flat ${fmtCurrency(Number(promo.value))} off` : "Buy X Get Y"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </button>

                                                                {/* Per-item scope selector */}
                                                                {isSelected && (
                                                                    <div className="mt-2 border rounded-lg px-3 py-2 bg-muted/20 space-y-2">
                                                                        <button
                                                                            onClick={() => setShowPromoScope(v => !v)}
                                                                            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                                        >
                                                                            {showPromoScope ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                                            Apply to: {promoScopeAll ? "All items" : `${promoScopedItems.size} item(s)`}
                                                                        </button>
                                                                        {showPromoScope && (
                                                                            <div className="space-y-1.5">
                                                                                <label className="flex items-center gap-2 text-xs cursor-pointer">
                                                                                    <Checkbox
                                                                                        checked={promoScopeAll}
                                                                                        onCheckedChange={(v) => {
                                                                                            setPromoScopeAll(!!v);
                                                                                            if (v) setPromoScopedItems(new Set(cartItems.map(i => i.id)));
                                                                                            else setPromoScopedItems(new Set());
                                                                                        }}
                                                                                    />
                                                                                    <span className="font-medium">All items</span>
                                                                                </label>
                                                                                {cartItems.map((item) => (
                                                                                    <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer ml-1">
                                                                                        <Checkbox
                                                                                            checked={promoScopedItems.has(item.id)}
                                                                                            onCheckedChange={(v) => {
                                                                                                const next = new Set(promoScopedItems);
                                                                                                v ? next.add(item.id) : next.delete(item.id);
                                                                                                setPromoScopedItems(next);
                                                                                                setPromoScopeAll(next.size === cartItems.length);
                                                                                            }}
                                                                                        />
                                                                                        <span className="truncate">{item.name}</span>
                                                                                        <span className="font-mono text-muted-foreground ml-auto">{fmtCurrency(item.total)}</span>
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </details>
                            )}

                            {canCoupon && <Separator />}

                            {/* ── Coupon Code ── */}
                            {canCoupon && (
                            <details className={cn(discountMode !== "none" && discountMode !== "coupon" && "opacity-50 pointer-events-none")}>
                                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors border-b">
                                    <TicketPercent className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm flex-1">Coupon / Voucher Code</span>
                                    {appliedCoupon && <Badge variant="secondary" className="text-xs">{appliedCoupon.code}</Badge>}
                                    {discountMode !== "none" && discountMode !== "coupon" && (
                                        <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                                    )}
                                </summary>
                                <div className="p-3 space-y-2">
                                    <div className="flex gap-2">
                                        <Input
                                            ref={couponInputRef}
                                            className="uppercase font-mono flex-1"
                                            placeholder="Coupon or voucher code... (F2)"
                                            value={couponInput}
                                            onChange={(e) => { setCouponInput(e.target.value); setCouponError(""); }}
                                            onKeyDown={(e) => e.key === "Enter" && handleValidateCoupon()}
                                            disabled={!!appliedCoupon || (discountMode !== "none" && discountMode !== "coupon")}
                                        />
                                        <Button size="sm" onClick={handleValidateCoupon}
                                            disabled={isValidatingCoupon || !couponInput.trim() || (discountMode !== "none" && discountMode !== "coupon")}>
                                            {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                                        </Button>
                                    </div>
                                    {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                                    {appliedCoupon?.description && <p className="text-xs text-muted-foreground">{appliedCoupon.description}</p>}
                                </div>
                            </details>
                            )}

                            {canAlliance && <Separator />}

                            {/* ── Alliances ── */}
                            {canAlliance && (
                            <details ref={allianceDetailsRef} className={cn(discountMode !== "none" && discountMode !== "alliance" && "opacity-50 pointer-events-none")} open>
                                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <Handshake className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm flex-1">Alliance / Bank Card</span>
                                    {selectedAlliance && <Badge variant="secondary" className="text-xs">{selectedAlliance.code}</Badge>}
                                    {discountMode !== "none" && discountMode !== "alliance" && (
                                        <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                                    )}
                                </summary>
                                <div className="p-3 space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input ref={allianceSearchRef} className="pl-8 text-sm" placeholder="Search bank, card type, or BIN... (F3)"
                                            value={allianceSearch} onChange={(e) => setAllianceSearch(e.target.value)} />
                                    </div>
                                    {isLoadingConfig ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                        </div>
                                    ) : (
                                        <div className="max-h-[200px] overflow-y-auto">
                                            <div className="space-y-1.5 pr-1">
                                                {filteredAlliances.length === 0 && (
                                                    <p className="text-xs text-muted-foreground italic py-1">No matching alliances.</p>
                                                )}
                                                {filteredAlliances.map((a) => {
                                                    let disc = 0;
                                                    const allianceBase = subtotalAfterItems;
                                                    if (a.maxDiscount) {
                                                        disc = Math.min(
                                                            Math.round(allianceBase * (Number(a.discountPercent) / 100)),
                                                            Number(a.maxDiscount)
                                                        );
                                                    } else {
                                                        disc = Math.round(allianceBase * (Number(a.discountPercent) / 100));
                                                    }
                                                    const isSelected = selectedAlliance?.id === a.id && discountMode === "alliance";
                                                    const disabled = discountMode !== "none" && !isSelected;
                                                    return (
                                                        <div key={a.id}>
                                                            <button
                                                                disabled={disabled}
                                                                onClick={() => {
                                                                    if (isSelected) { clearDiscount(); return; }
                                                                    clearDiscount();
                                                                    setSelectedAlliance(a);
                                                                    setDiscountMode("alliance");
                                                                }}
                                                                className={cn(
                                                                    "w-full text-left rounded-lg border px-3 py-2 transition-all text-sm",
                                                                    isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-muted-foreground",
                                                                    disabled && "opacity-40 cursor-not-allowed"
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <p className="font-medium text-xs">{a.partnerName}</p>
                                                                        <p className="text-[10px] text-muted-foreground">{a.description || a.code}</p>
                                                                        {a.binNumbers.length > 0 && (
                                                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                                                BIN: {a.binNumbers.slice(0, 3).join(", ")}{a.binNumbers.length > 3 ? ` +${a.binNumbers.length - 3}` : ""}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right shrink-0 ml-2">
                                                                        <p className="font-bold text-primary font-mono text-xs">−{fmtCurrency(disc)}</p>
                                                                        <p className="text-[10px] text-muted-foreground">{a.discountPercent}% off</p>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            {/* Alliance meta fields */}
                                                            {isSelected && (
                                                                <div className="mt-2 border rounded-lg px-3 py-2 bg-muted/20 space-y-2">
                                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alliance Discount Details</p>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div>
                                                                            <Label className="text-xs">Bank</Label>
                                                                            <Input className="h-7 text-xs mt-0.5" placeholder="e.g. Meezan"
                                                                                value={a.partnerName} readOnly />
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-xs">Amount</Label>
                                                                            <Input className="h-7 text-xs mt-0.5 font-mono" value={fmtCurrency(disc)} readOnly />
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-xs">Cardholder Name</Label>
                                                                            <Input className="h-7 text-xs mt-0.5" placeholder="Name on card"
                                                                                value={allianceMeta.cardholderName}
                                                                                onChange={e => setAllianceMeta(m => ({ ...m, cardholderName: e.target.value }))} />
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-xs">Card # (last 4)</Label>
                                                                            <Input className="h-7 text-xs mt-0.5 font-mono" placeholder="••••"
                                                                                maxLength={4}
                                                                                value={allianceMeta.cardLast4}
                                                                                onChange={e => setAllianceMeta(m => ({ ...m, cardLast4: e.target.value.replace(/\D/, "") }))} />
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <Label className="text-xs">Merchant Slip #</Label>
                                                                            <Input className="h-7 text-xs mt-0.5" placeholder="Bank slip reference"
                                                                                value={allianceMeta.merchantSlip}
                                                                                onChange={e => setAllianceMeta(m => ({ ...m, merchantSlip: e.target.value }))} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </details>
                            )}

                            {canManualDiscount && <Separator />}

                            {/* ── Manual Global Discount ── */}
                            {canManualDiscount && (
                            <details className={cn(discountMode !== "none" && discountMode !== "manual" && "opacity-50 pointer-events-none")}>
                                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm flex-1">Manual Discount</span>
                                    {discountMode === "manual" && orderDiscount > 0 &&
                                        <Badge variant="secondary" className="text-xs">−{fmtCurrency(orderDiscount)}</Badge>}
                                    {discountMode !== "none" && discountMode !== "manual" && (
                                        <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                                    )}
                                </summary>
                                <div className="p-3 space-y-3">
                                    <RadioGroup
                                        value={manualDiscountType}
                                        onValueChange={(v: any) => setManualDiscountType(v)}
                                        className="flex gap-4"
                                        disabled={discountMode !== "none" && discountMode !== "manual"}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <RadioGroupItem value="percent" id="disc-pct" />
                                            <Label htmlFor="disc-pct" className="text-sm flex items-center gap-1">
                                                <Percent className="h-3 w-3" /> Percentage
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <RadioGroupItem value="flat" id="disc-flat" />
                                            <Label htmlFor="disc-flat" className="text-sm">Flat PKR</Label>
                                        </div>
                                    </RadioGroup>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={manualDiscountType === "percent" ? 100 : undefined}
                                            className="font-mono"
                                            placeholder={manualDiscountType === "percent" ? "0 – 100" : "Amount"}
                                            value={manualDiscountValue || ""}
                                            onChange={(e) => {
                                                const v = parseFloat(e.target.value) || 0;
                                                setManualDiscountValue(v);
                                                if (v > 0) setDiscountMode("manual");
                                                else if (discountMode === "manual") setDiscountMode("none");
                                            }}
                                            disabled={discountMode !== "none" && discountMode !== "manual"}
                                        />
                                        {discountMode === "manual" && (
                                            <Button variant="ghost" size="icon" onClick={clearDiscount}>
                                                <XCircle className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                    {discountMode === "manual" && orderDiscount > 0 && (
                                        <p className="text-xs text-primary font-semibold">Discount: −{fmtCurrency(orderDiscount)}</p>
                                    )}
                                </div>
                            </details>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Totals + Payment ───────────────────────────────────── */}
                    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-0.5">

                        {/* ── Totals ────────────────────────────────────────────── */}
                        <div className="rounded-xl border bg-card px-4 py-3 space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal ({cartItems.length} item{cartItems.length !== 1 ? "s" : ""})</span>
                                <span className="font-mono">{fmtCurrency(subtotal)}</span>
                            </div>
                            {finalItemDiscounts > 0 && (
                                <div className="flex justify-between text-destructive">
                                    <span>Item Discounts</span>
                                    <span className="font-mono">−{fmtCurrency(finalItemDiscounts)}</span>
                                </div>
                            )}
                            {/* Show suppressed item discounts when alliance wins */}
                            {discountMode === "alliance" && finalItemDiscounts === 0 && itemDiscounts > 0 && (
                                <div className="flex justify-between text-muted-foreground line-through text-xs">
                                    <span>Item Discounts (overridden)</span>
                                    <span className="font-mono">−{fmtCurrency(itemDiscounts)}</span>
                                </div>
                            )}
                            {orderDiscount > 0 && (
                                <div className="flex justify-between text-primary">
                                    <span>
                                        {discountMode === "promo" && selectedPromo && `Promo: ${selectedPromo.code}`}
                                        {discountMode === "coupon" && appliedCoupon && `Coupon: ${appliedCoupon.code}`}
                                        {discountMode === "alliance" && selectedAlliance && `Alliance: ${selectedAlliance.code}`}
                                        {discountMode === "manual" && "Manual Discount"}
                                    </span>
                                    <span className="font-mono">−{fmtCurrency(orderDiscount)}</span>
                                </div>
                            )}
                            {itemTax > 0 && (
                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                    <span>Total Tax</span>
                                    <span className="font-mono">+{fmtCurrency(itemTax)}</span>
                                </div>
                            )}
                            <Separator />
                            <div className="flex justify-between text-lg font-bold">
                                <span>Grand Total</span>
                                <span className="font-mono">{fmtCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        {/* ── Payment Panel ─────────────────────────────────────── */}
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-sm">Payment</span>
                            </div>
                            <div className="p-3 space-y-3">
                                {/* Tender type + amount */}
                                <div className="space-y-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                                            Tender Type
                                            {discountMode === "alliance" && selectedAlliance && (
                                                <span className="ml-2 text-xs text-primary font-normal">(Card payment required for alliance)</span>
                                            )}
                                        </Label>
                                        <Select 
                                            value={tenderMethod} 
                                            onValueChange={setTenderMethod}
                                            disabled={discountMode === "alliance" && selectedAlliance}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TENDER_OPTIONS.map(({ value, label, icon: Icon }) => (
                                                    <SelectItem key={value} value={value}>
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="h-3.5 w-3.5" /> {label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Amount to Pay</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            className="mt-1 font-mono"
                                            placeholder={`${fmtCurrency(balanceDue)}`}
                                            value={tenderAmount || ""}
                                            onChange={(e) => setTenderAmount(parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => e.key === "Enter" && addTender()}
                                        />
                                    </div>
                                    {tenderMethod === "credit_account" && !selectedCustomer && (
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700">
                                            <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                            <span>Select a customer above to post this sale to their Credit Account (Accounts Receivable).</span>
                                        </div>
                                    )}
                                    {tenderMethod === "credit_account" && selectedCustomer && (
                                        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700">
                                            <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                            <span>Will be posted to <strong>{selectedCustomer.name}</strong>'s Credit Account as an outstanding receivable.</span>
                                        </div>
                                    )}
                                    {(tenderMethod === "card" || tenderMethod === "bank_transfer") && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Card # (last 4)</Label>
                                                <Input className="mt-1 h-8 text-xs font-mono" maxLength={4} placeholder="••••"
                                                    value={tenderCardLast4}
                                                    onChange={(e) => setTenderCardLast4(e.target.value.replace(/\D/, ""))} />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Slip / Ref #</Label>
                                                <Input className="mt-1 h-8 text-xs" placeholder="Ref"
                                                    value={tenderSlip} onChange={(e) => setTenderSlip(e.target.value)} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Voucher tender — debounced code lookup */}
                                    {tenderMethod === "voucher" && (
                                        <div className="space-y-2">
                                            <div>
                                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Voucher Code</Label>
                                                <div className="relative mt-1">
                                                    <Input
                                                        className={cn(
                                                            "font-mono uppercase pr-8 h-9 text-sm",
                                                            validatedVoucher && "border-emerald-400 focus-visible:ring-emerald-400",
                                                            voucherError && "border-destructive focus-visible:ring-destructive",
                                                        )}
                                                        placeholder="e.g. GFT-ABC123"
                                                        value={voucherCode}
                                                        onChange={(e) => handleVoucherCodeChange(e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && validateVoucherCode(voucherCode)}
                                                        maxLength={10}
                                                    />
                                                    <div className="absolute right-2 top-2">
                                                        {voucherValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                        {!voucherValidating && validatedVoucher && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                                        {!voucherValidating && voucherError && <XCircle className="h-4 w-4 text-destructive" />}
                                                    </div>
                                                </div>
                                                {voucherError && <p className="text-xs text-destructive mt-1">{voucherError}</p>}
                                            </div>
                                            {validatedVoucher && (
                                                <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-emerald-700">{validatedVoucher.code}</span>
                                                        <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700">
                                                            {validatedVoucher.voucherType.replace("_", " ")}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs text-emerald-700">
                                                        <span>{validatedVoucher.description || "Voucher"}</span>
                                                        <span className="font-mono font-bold">{fmtCurrency(validatedVoucher.faceValue)}</span>
                                                    </div>
                                                    {validatedVoucher.requireCustomerMatch && (
                                                        <p className="text-[10px] text-amber-600">Customer-bound — verified ✓</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <Button
                                        className="w-full gap-2"
                                        disabled={tenderMethod === "voucher" && !validatedVoucher}
                                        onClick={() => {
                                            if (tenderMethod === "voucher") {
                                                addVoucherTender();
                                                return;
                                            }
                                            if (!tenderAmount || tenderAmount <= 0) {
                                                setTenderAmount(balanceDue);
                                                return;
                                            }
                                            addTender();
                                        }}
                                    >
                                        <Plus className="h-4 w-4" /> Add Payment
                                    </Button>
                                </div>

                                {/* Tenders list */}
                                {tenders.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="grid grid-cols-[1fr_auto_auto] text-xs text-muted-foreground font-medium px-1">
                                            <span>Method</span><span>Amount</span><span></span>
                                        </div>
                                        {tenders.map((t, i) => {
                                            const Icon = TENDER_OPTIONS.find(o => o.value === t.method)?.icon ?? Banknote;
                                            return (
                                                <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded px-2 py-1.5 bg-muted/30 text-sm">
                                                    <span className="flex items-center gap-1.5 capitalize">
                                                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {t.method.replace("_", " ")}
                                                        {t.cardLast4 && <span className="text-xs text-muted-foreground font-mono">••{t.cardLast4}</span>}
                                                        {t.slipNo && <span className="text-xs text-muted-foreground font-mono">#{t.slipNo}</span>}
                                                    </span>
                                                    <span className="font-mono font-semibold">{fmtCurrency(t.amount)}</span>
                                                    <button onClick={() => setTenders(prev => prev.filter((_, j) => j !== i))}
                                                        className="text-muted-foreground hover:text-destructive transition-colors">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Balance due - hide when fully paid with no change */}
                                {!(balanceDue <= 0 && changeAmount === 0) && (
                                    <div className={cn(
                                        "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold",
                                        balanceDue <= 0 ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
                                    )}>
                                        <span>{balanceDue <= 0 ? (changeAmount > 0 ? "Change" : "Balance Paid ✓") : "Balance Due"}</span>
                                        <span className="font-mono">
                                            {balanceDue <= 0 && changeAmount > 0 ? fmtCurrency(changeAmount) : fmtCurrency(balanceDue)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Gift Receipt Option ───────────────────────────────── */}
                        <div className="rounded-xl border bg-card px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Checkbox 
                                    id="gift-receipt" 
                                    checked={isGiftReceipt}
                                    onCheckedChange={(checked) => setIsGiftReceipt(checked as boolean)}
                                />
                                <div className="flex-1">
                                    <Label htmlFor="gift-receipt" className="text-sm font-semibold cursor-pointer">
                                        Gift Receipt
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Print receipt without price information
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Complete Sale ─────────────────────────────────────── */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-14 font-bold gap-2 rounded-xl border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                onClick={() => handleHold()}
                                disabled={isSubmitting || isHolding || cartItems.length === 0}
                            >
                                {isHolding
                                    ? <><Loader2 className="h-5 w-5 animate-spin" /> Holding...</>
                                    : <><PauseCircle className="h-5 w-5" /> Hold</>
                                }
                            </Button>
                            
                            {/* Credit Sale Button - Only show if customer selected and balance due */}
                            {selectedCustomer && balanceDue > 0 && (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-14 font-bold gap-2 rounded-xl border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                    onClick={handleCreditSale}
                                    disabled={isSubmitting || cartItems.length === 0}
                                >
                                    {isSubmitting
                                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>
                                        : <><BookOpen className="h-5 w-5" /> Credit Sale</>
                                    }
                                </Button>
                            )}
                            
                            {/* Preview Receipt Button - Only show when balance is paid */}
                            {balanceDue === 0 && cartItems.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-14 font-bold gap-2 rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                                    onClick={() => setShowReceiptPreview(true)}
                                    disabled={isSubmitting}
                                >
                                    <Receipt className="h-5 w-5" /> Preview Receipt
                                </Button>
                            )}
                            
                            <Button
                                size="lg"
                                className="h-14 flex-1 text-base font-bold gap-2 rounded-xl"
                                onClick={handleConfirm}
                                disabled={isSubmitting || cartItems.length === 0 || balanceDue > 0}
                            >
                                {isSubmitting
                                    ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>
                                    : balanceDue > 0
                                        ? `Balance Due: ${fmtCurrency(balanceDue)}`
                                        : <><Printer className="h-5 w-5" /> Complete Sale & Print Receipt</>
                                }
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Receipt Preview Dialog - Shows preview before completing sale */}
            {showReceiptPreview && (
                <PrintReceipt
                    order={{
                        orderNumber: "PREVIEW",
                        createdAt: new Date().toISOString(),
                        subtotal,
                        taxAmount: itemTax,
                        globalDiscountAmount: orderDiscount,
                        grandTotal,
                        fbrPosFee: 1,
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

            {/* Show receipt dialog upon completion */}
            {completedOrder && !showGiftReceiptAfterSales && (
                <PrintReceipt
                    order={{ ...completedOrder, isGiftReceipt: false }}
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
                            // After closing the sales receipt, show the gift receipt
                            setShowGiftReceiptAfterSales(true);
                        } else {
                            setCompletedOrder(null);
                            router.push("/pos/new-sale");
                        }
                    }}
                />
            )}

            {/* Gift receipt — shown after sales receipt when isGiftReceipt is true */}
            {completedOrder && showGiftReceiptAfterSales && (
                <PrintReceipt
                    order={{ ...completedOrder, isGiftReceipt: true }}
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
