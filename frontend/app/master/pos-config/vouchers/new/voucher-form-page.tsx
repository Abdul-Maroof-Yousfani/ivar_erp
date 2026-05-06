"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Gift, Copy, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { issueVoucher, Voucher, VoucherType } from "@/lib/actions/vouchers";
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
    const [description, setDescription] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [locationIds, setLocationIds] = useState<string[]>([]);
    const [issuedVoucher, setIssuedVoucher] = useState<Voucher | null>(null);

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
        startTransition(async () => {
            const result = await issueVoucher({
                voucherType,
                faceValue: Number(faceValue),
                description: description || undefined,
                companyName: companyName || undefined,
                expiresAt: expiresAt || undefined,
                locationIds,
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
