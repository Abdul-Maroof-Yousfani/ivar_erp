"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Gift, Copy, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { issueVoucher, Voucher, VoucherType, getMerchants, MerchantConfig } from "@/lib/actions/vouchers";
import { Location } from "@/lib/actions/location";
import { LocationMultiSelect } from "../../_components/location-multi-select";
import { formatCurrency } from "@/lib/utils";

interface Props { locations: Location[] }

const VOUCHER_TYPE_OPTIONS: { value: VoucherType; label: string }[] = [
    { value: "GIFT", label: "Gift Voucher" },
    { value: "CREDIT", label: "Credit Voucher" },
    { value: "CORPORATE", label: "Corporate Gift" },
    { value: "OUTLET_GIFT", label: "Outlet Gift" },
];

export function VoucherFormPage({ locations }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [voucherType, setVoucherType] = useState<VoucherType>("GIFT");
    const [faceValue, setFaceValue] = useState<number | "">("");
    const [discount, setDiscount] = useState<number | "">("");
    const [description, setDescription] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [locationIds, setLocationIds] = useState<string[]>([]);
    const [issuedVoucher, setIssuedVoucher] = useState<Voucher | null>(null);

    // ── Payment Mode state variables ──────────────────────────────
    const [paymentMode, setPaymentMode] = useState<"CASH" | "CARD">("CASH");
    const [merchantId, setMerchantId] = useState<string>("");
    const [cardholderName, setCardholderName] = useState<string>("");
    const [cardLast4, setCardLast4] = useState<string>("");
    const [slipNo, setSlipNo] = useState<string>("");

    const [merchants, setMerchants] = useState<MerchantConfig[]>([]);
    const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);

    useEffect(() => {
        setIsLoadingMerchants(true);
        // Admin gets all active merchants, potentially filtered if we want
        getMerchants()
            .then(res => {
                if (res.status && res.data) setMerchants(res.data);
            })
            .catch(() => toast.error("Failed to load merchant terminals"))
            .finally(() => setIsLoadingMerchants(false));
    }, []);

    const goBack = () => {
        startTransition(() => {
            router.push("/master/pos-config/vouchers");
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!faceValue || Number(faceValue) <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        if (discount && (Number(discount) < 0 || Number(discount) >= Number(faceValue))) {
            toast.error("Discount must be positive and less than the face value");
            return;
        }
        if (voucherType === "GIFT" && paymentMode === "CARD") {
            if (!merchantId) {
                toast.error("Merchant terminal is required for card payments");
                return;
            }
            if (cardLast4 && !/^\d{4}$/.test(cardLast4)) {
                toast.error("Card last 4 digits must be exactly 4 digits");
                return;
            }
        }
        startTransition(async () => {
            const result = await issueVoucher({
                voucherType,
                faceValue: Number(faceValue),
                discount: discount ? Number(discount) : 0,
                description: description || undefined,
                companyName: companyName || undefined,
                expiresAt: expiresAt || undefined,
                locationIds,
                paymentMode: voucherType === "GIFT" ? paymentMode : undefined,
                merchantId: (voucherType === "GIFT" && paymentMode === "CARD") ? merchantId : undefined,
                cardholderName: (voucherType === "GIFT" && paymentMode === "CARD") ? cardholderName || undefined : undefined,
                cardLast4: (voucherType === "GIFT" && paymentMode === "CARD") ? cardLast4 || undefined : undefined,
                slipNo: (voucherType === "GIFT" && paymentMode === "CARD") ? slipNo || undefined : undefined,
            });
            if (result.status && result.data) {
                setIssuedVoucher(result.data);
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-xl font-semibold">Issue Voucher</h2>
                </div>
            </div>

            {/* Two-column layout */}
            <form onSubmit={handleSubmit}>
                <div className="flex gap-6 items-start">
                    {/* Left — form fields */}
                    <div className="flex-1 min-w-0 space-y-5 sticky top-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Voucher Type *</Label>
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
                                <Input
                                    type="number" min="1"
                                    value={faceValue}
                                    onChange={(e) => setFaceValue(e.target.value ? Number(e.target.value) : "")}
                                    placeholder="e.g. 1000"
                                />
                            </div>
                        </div>

                        {voucherType === "GIFT" && (
                            <>
                                <div className="space-y-4 rounded-lg border p-4 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="space-y-2">
                                        <Label>Payment Method *</Label>
                                        <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CASH">Cash</SelectItem>
                                                <SelectItem value="CARD">Credit Card</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {paymentMode === "CARD" && (
                                        <div className="space-y-3 pt-2 border-t">
                                            <div className="space-y-2">
                                                <Label>Merchant / Bank Terminal *</Label>
                                                <Select value={merchantId} onValueChange={setMerchantId}>
                                                    <SelectTrigger>
                                                        {isLoadingMerchants ? "Loading terminals..." : <SelectValue placeholder="Select merchant terminal..." />}
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {merchants.length === 0 && (
                                                            <div className="p-2 text-center text-xs text-muted-foreground italic">
                                                                No merchant terminals configured
                                                            </div>
                                                        )}
                                                        {merchants.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>
                                                                {m.bankName} - {m.description} (#{m.merchantCode})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-2">
                                                    <Label>Cardholder Name</Label>
                                                    <Input value={cardholderName} onChange={e => setCardholderName(e.target.value)} placeholder="Name on card" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Card # (last 4)</Label>
                                                    <Input value={cardLast4} maxLength={4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>AUTH ID / Approval Code</Label>
                                                <Input value={slipNo} onChange={e => setSlipNo(e.target.value)} placeholder="Slip or reference number" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <Label>Discount (Rs.)</Label>
                                    <Input
                                        type="number" min="0"
                                        value={discount}
                                        onChange={(e) => setDiscount(e.target.value ? Number(e.target.value) : "")}
                                        placeholder="e.g. 100"
                                    />
                                </div>
                            </>
                        )}

                        {voucherType === "CORPORATE" && (
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Description (Optional)</Label>
                            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Birthday gift" />
                        </div>

                        <div className="space-y-2">
                            <Label>Expiry Date (Optional)</Label>
                            <Input
                                type="date"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={goBack} disabled={isPending}>Cancel</Button>
                            <Button type="submit" disabled={isPending} className="gap-2">
                                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Gift className="h-4 w-4" /> Issue Voucher
                            </Button>
                        </div>
                    </div>

                    {/* Right — location selection */}
                    <div className="w-72 shrink-0 sticky top-4 max-h-[calc(100vh-5rem)] flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
                            <MapPin className="h-4 w-4" />
                            Allowed Locations
                            <span className="text-xs font-normal">(empty = all)</span>
                        </div>
                        <LocationMultiSelect
                            locations={locations}
                            selected={locationIds}
                            onChange={setLocationIds}
                            disabled={isPending}
                        />
                    </div>
                </div>
            </form>

            {/* Success confirmation */}
            {issuedVoucher && (
                <Dialog open onOpenChange={() => { setIssuedVoucher(null); goBack(); }}>
                    <DialogContent className="sm:max-w-90">
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
                                <Button
                                    variant="outline"
                                    onClick={() => { navigator.clipboard.writeText(issuedVoucher.code); toast.success("Copied"); }}
                                    className="flex-1 gap-2"
                                >
                                    <Copy className="w-4 h-4" /> Copy
                                </Button>
                                <Button onClick={() => { setIssuedVoucher(null); goBack(); }} className="flex-1">Done</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
