"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Loader2, Plus, Trash2, CreditCard, Banknote, Building2, Ticket, BookOpen,
    CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tender, Customer, AllianceConfig, DiscountMode } from "./page";

export interface MerchantConfig {
    id: string;
    description: string;
    bankName: string;
    merchantCode: number;
    commissionRate: string | number;
    tagId: string;
    costCentreTag: string;
    bankGlCode: string;
}

interface ValidatedVoucher {
    id: string;
    code: string;
    voucherType: string;
    faceValue: number;
    description?: string;
    customerId?: string;
    requireCustomerMatch: boolean;
}

const TENDER_OPTIONS = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card", icon: CreditCard },
    { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
    { value: "voucher", label: "Voucher", icon: Ticket },
    { value: "credit_account", label: "Credit Account", icon: BookOpen },
];

interface PaymentPanelProps {
    tenders: Tender[];
    tenderMethod: string;
    tenderAmount: number;
    tenderCardholderName: string;
    tenderCardLast4: string;
    tenderSlip: string;
    balanceDue: number;
    changeAmount: number;
    discountMode: DiscountMode;
    selectedAlliance: AllianceConfig | null;
    selectedCustomer: Customer | null;
    // Merchant
    merchants: MerchantConfig[];
    selectedMerchant: MerchantConfig | null;
    isLoadingMerchants: boolean;
    onMerchantChange: (merchant: MerchantConfig | null) => void;
    // Voucher
    voucherCode: string;
    validatedVoucher: ValidatedVoucher | null;
    voucherError: string | null;
    voucherValidating: boolean;
    // Refs
    tenderAmountRef: React.RefObject<HTMLInputElement | null>;
    // Handlers
    onTenderMethodChange: (method: string) => void;
    onTenderAmountChange: (amount: number) => void;
    onTenderCardholderNameChange: (val: string) => void;
    onTenderCardLast4Change: (val: string) => void;
    onTenderSlipChange: (val: string) => void;
    onAddTender: () => void;
    onAddVoucherTender: () => void;
    onRemoveTender: (index: number) => void;
    onVoucherCodeChange: (val: string) => void;
    onVoucherValidate: (code: string) => void;
    fmtCurrency: (v: number) => string;
}

export function PaymentPanel({
    tenders, tenderMethod, tenderAmount, tenderCardholderName, tenderCardLast4, tenderSlip,
    balanceDue, changeAmount, discountMode, selectedAlliance, selectedCustomer,
    merchants, selectedMerchant, isLoadingMerchants, onMerchantChange,
    voucherCode, validatedVoucher, voucherError, voucherValidating,
    tenderAmountRef,
    onTenderMethodChange, onTenderAmountChange,
    onTenderCardholderNameChange, onTenderCardLast4Change, onTenderSlipChange,
    onAddTender, onAddVoucherTender, onRemoveTender,
    onVoucherCodeChange, onVoucherValidate,
    fmtCurrency,
}: PaymentPanelProps) {
    return (
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
                            onValueChange={onTenderMethodChange}
                            disabled={!!(discountMode === "alliance" && selectedAlliance)}
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
                            ref={tenderAmountRef}
                            type="number"
                            min={0}
                            className="mt-1 font-mono"
                            placeholder={`${fmtCurrency(balanceDue)}`}
                            value={tenderAmount || ""}
                            onChange={(e) => onTenderAmountChange(parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => e.key === "Enter" && onAddTender()}
                        />
                    </div>

                    {/* Credit account notices */}
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

                    {/* Card / bank transfer extra fields */}
                    {(tenderMethod === "card" || tenderMethod === "bank_transfer") && (
                        <div className="space-y-2">
                            {/* Alliance context banner */}
                            {discountMode === "alliance" && selectedAlliance && (
                                <div className="flex items-start gap-2 rounded-lg border border-blue-300/60 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                                    <CreditCard className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        Card details below will be recorded for the{" "}
                                        <strong>{selectedAlliance.partnerName}</strong> alliance discount on this order.
                                    </span>
                                </div>
                            )}

                            {/* ── Merchant selector ── */}
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Merchant / Bank Terminal
                                    <span className="text-destructive ml-0.5">*</span>
                                </Label>
                                <Select
                                    value={selectedMerchant?.id || ""}
                                    onValueChange={(val) => {
                                        if (!val) { onMerchantChange(null); return; }
                                        const m = merchants.find(m => m.id === val);
                                        onMerchantChange(m || null);
                                    }}
                                >
                                    <SelectTrigger className={cn(
                                        "mt-1 h-9",
                                        !selectedMerchant && "border-amber-400 focus:ring-amber-400"
                                    )}>
                                        {isLoadingMerchants ? (
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading merchants...
                                            </span>
                                        ) : (
                                            <SelectValue placeholder="Select merchant terminal..." />
                                        )}
                                    </SelectTrigger>
                                    <SelectContent>
                                        {merchants.length === 0 && !isLoadingMerchants && (
                                            <div className="p-3 text-center text-xs text-muted-foreground italic">
                                                No merchants configured for this location
                                            </div>
                                        )}
                                        {merchants.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                <div className="flex flex-col py-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">{m.bankName}</span>
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
                                                            #{m.merchantCode}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {m.description} · {(Number(m.commissionRate) * 100).toFixed(2)}% commission
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {!selectedMerchant && merchants.length > 0 && (
                                    <p className="text-[10px] text-amber-600 mt-1">Select the bank terminal used for this card payment</p>
                                )}
                                {selectedMerchant && (
                                    <div className="mt-1.5 flex items-center gap-3 rounded-md bg-muted/30 border px-2.5 py-1.5 text-xs">
                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium">{selectedMerchant.bankName}</span>
                                            <span className="text-muted-foreground ml-2">Commission: {(Number(selectedMerchant.commissionRate) * 100).toFixed(2)}%</span>
                                        </div>
                                        <span className="font-mono text-muted-foreground text-[10px]">{selectedMerchant.tagId}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="col-span-2">
                                    <Label className="text-xs text-muted-foreground">Cardholder Name</Label>
                                    <Input
                                        className="mt-1 h-8 text-xs"
                                        placeholder="Name on card"
                                        value={tenderCardholderName}
                                        onChange={(e) => onTenderCardholderNameChange(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">
                                        Card # (last 4){discountMode === "alliance" && selectedAlliance && <span className="text-destructive font-bold ml-0.5">*</span>}
                                    </Label>
                                    <Input className="mt-1 h-8 text-xs font-mono" maxLength={4} placeholder="••••"
                                        value={tenderCardLast4}
                                        onChange={(e) => onTenderCardLast4Change(e.target.value.replace(/\D/, ""))} />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">AUTH ID / Approval Code</Label>
                                    <Input className="mt-1 h-8 text-xs" placeholder="Slip or ref"
                                        value={tenderSlip}
                                        onChange={(e) => onTenderSlipChange(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Voucher tender */}
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
                                        onChange={(e) => onVoucherCodeChange(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && onVoucherValidate(voucherCode)}
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
                        disabled={
                            (tenderMethod === "voucher" && !validatedVoucher) ||
                            ((tenderMethod === "card" || tenderMethod === "bank_transfer") && !selectedMerchant && merchants.length > 0)
                        }
                        onClick={() => {
                            if (tenderMethod === "voucher") {
                                onAddVoucherTender();
                                return;
                            }
                            if (!tenderAmount || tenderAmount <= 0) {
                                onTenderAmountChange(balanceDue);
                                return;
                            }
                            onAddTender();
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
                            const Icon = TENDER_OPTIONS.find((o) => o.value === t.method)?.icon ?? Banknote;
                            return (
                                <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded px-2 py-1.5 bg-muted/30 text-sm">
                                    <span className="flex items-center gap-1.5 capitalize">
                                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t.method.replace("_", " ")}
                                        {t.cardLast4 && <span className="text-xs text-muted-foreground font-mono">••{t.cardLast4}</span>}
                                        {t.slipNo && <span className="text-xs text-muted-foreground font-mono">#{t.slipNo}</span>}
                                    </span>
                                    <span className="font-mono font-semibold">{fmtCurrency(t.amount)}</span>
                                    <button
                                        onClick={() => onRemoveTender(i)}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Balance due / change */}
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
    );
}
