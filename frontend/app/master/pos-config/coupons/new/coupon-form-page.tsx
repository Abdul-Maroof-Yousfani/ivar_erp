"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Ticket } from "lucide-react";
import { toast } from "sonner";
import { CouponCode, createCoupon, updateCoupon } from "@/lib/actions/pos-config";
import { Location } from "@/lib/actions/location";
import { LocationMultiSelect } from "../../_components/location-multi-select";

interface Props {
    locations: Location[];
    coupon?: CouponCode;
}

export function CouponFormPage({ locations, coupon }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [locationIds, setLocationIds] = useState<string[]>(
        coupon?.locations.map((l) => l.location.id) ?? []
    );

    const goBack = () => {
        startTransition(() => {
            router.push("/master/pos-config/coupons");
        });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const isActiveHidden = fd.get("isActiveHidden");
        const data = {
            code: fd.get("code") as string,
            description: (fd.get("description") as string) || undefined,
            discountType: fd.get("discountType") as string,
            discountValue: Number(fd.get("discountValue")),
            maxUses: fd.get("maxUses") ? Number(fd.get("maxUses")) : undefined,
            minOrderAmount: fd.get("minOrderAmount") ? Number(fd.get("minOrderAmount")) : undefined,
            maxDiscount: fd.get("maxDiscount") ? Number(fd.get("maxDiscount")) : undefined,
            expiresAt: (fd.get("expiresAt") as string) || undefined,
            isActive: isActiveHidden !== null ? isActiveHidden === "true" : true,
            locationIds,
        };

        startTransition(async () => {
            const result = coupon
                ? await updateCoupon(coupon.id, data)
                : await createCoupon(data);
            if (result.status) {
                toast.success(result.message ?? (coupon ? "Coupon updated" : "Coupon created"));
                goBack();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-xl font-semibold">{coupon ? "Edit Coupon Code" : "New Coupon Code"}</h2>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="code">Coupon Code *</Label>
                        <Input id="code" name="code" defaultValue={coupon?.code} required disabled={isPending} className="uppercase font-mono" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" name="description" defaultValue={coupon?.description ?? ""} disabled={isPending} />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Discount Type *</Label>
                        <Select name="discountType" defaultValue={coupon?.discountType ?? "percent"} disabled={isPending}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="percent">Percentage</SelectItem>
                                <SelectItem value="fixed">Fixed Amount</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="discountValue">Discount Value *</Label>
                        <Input id="discountValue" name="discountValue" type="number" step="0.01" defaultValue={coupon?.discountValue} required disabled={isPending} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="maxDiscount">Max Discount</Label>
                        <Input id="maxDiscount" name="maxDiscount" type="number" step="0.01" defaultValue={coupon?.maxDiscount ?? ""} disabled={isPending} placeholder="No limit" />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="maxUses">Max Uses</Label>
                        <Input id="maxUses" name="maxUses" type="number" defaultValue={coupon?.maxUses ?? ""} disabled={isPending} placeholder="Unlimited" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="minOrderAmount">Min Order Amount</Label>
                        <Input id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" defaultValue={coupon?.minOrderAmount ?? ""} disabled={isPending} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                        <Label>Expiry Date</Label>
                        <DatePicker
                            name="expiresAt"
                            value={coupon?.expiresAt ? new Date(coupon.expiresAt).toISOString().split("T")[0] : undefined}
                            disabled={isPending}
                            placeholder="No expiry"
                        />
                    </div>
                </div>

                {coupon && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                        <Switch
                            defaultChecked={coupon.isActive}
                            onCheckedChange={(checked) => {
                                const el = document.getElementById("isActiveHidden") as HTMLInputElement;
                                if (el) el.value = checked ? "true" : "false";
                            }}
                        />
                        <input type="hidden" id="isActiveHidden" name="isActiveHidden" defaultValue={coupon.isActive ? "true" : "false"} />
                        <Label className="cursor-pointer">Active</Label>
                        <span className="text-xs text-muted-foreground">Toggle to activate or deactivate this coupon</span>
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Assign Locations</Label>
                    <LocationMultiSelect locations={locations} selected={locationIds} onChange={setLocationIds} disabled={isPending} />
                </div>

                <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={goBack} disabled={isPending}>Cancel</Button>
                    <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {coupon ? "Update Coupon" : "Create Coupon"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
