"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, ArrowLeft, Megaphone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PromoCampaign, createPromo, updatePromo } from "@/lib/actions/pos-config";
import { Location } from "@/lib/actions/location";
import { LocationMultiSelect } from "../../_components/location-multi-select";
import { Switch } from "@/components/ui/switch";

interface Props {
    locations: Location[];
    promo?: PromoCampaign;
}

export function PromoFormPage({ locations, promo }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [locationIds, setLocationIds] = useState<string[]>(
        promo?.locations.map((l) => l.location.id) ?? []
    );

    const goBack = () => {
        startTransition(() => {
            router.push("/master/pos-config/promos");
        });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const isActiveHidden = fd.get("isActiveHidden");
        const data = {
            name: fd.get("name") as string,
            code: fd.get("code") as string,
            type: fd.get("type") as string,
            value: Number(fd.get("value")),
            minOrderAmount: fd.get("minOrderAmount") ? Number(fd.get("minOrderAmount")) : undefined,
            maxDiscount: fd.get("maxDiscount") ? Number(fd.get("maxDiscount")) : undefined,
            startDate: fd.get("startDate") as string,
            endDate: fd.get("endDate") as string,
            isActive: isActiveHidden !== null ? isActiveHidden === "true" : true,
            locationIds,
        };

        startTransition(async () => {
            const result = promo
                ? await updatePromo(promo.id, data)
                : await createPromo(data);
            if (result.status) {
                toast.success(result.message ?? (promo ? "Promo updated" : "Promo created"));
                goBack();
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
                    <Megaphone className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-xl font-semibold">{promo ? "Edit Promo Campaign" : "New Promo Campaign"}</h2>
                </div>
            </div>

            {/* Two-column layout */}
            <form onSubmit={handleSubmit}>
                <div className="flex gap-6 items-start">
                    {/* Left — form fields */}
                    <div className="flex-1 min-w-0 space-y-5 sticky top-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Campaign Name *</Label>
                                <Input id="name" name="name" defaultValue={promo?.name} required disabled={isPending} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Code *</Label>
                                <Input id="code" name="code" defaultValue={promo?.code} required disabled={isPending} className="uppercase" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Type *</Label>
                                <Select name="type" defaultValue={promo?.type ?? "percent"} disabled={isPending}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percent">Percentage</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                                        <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="value">Value *</Label>
                                <Input id="value" name="value" type="number" step="0.01" defaultValue={promo?.value} required disabled={isPending} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxDiscount">Max Discount</Label>
                                <Input id="maxDiscount" name="maxDiscount" type="number" step="0.01" defaultValue={promo?.maxDiscount ?? ""} disabled={isPending} placeholder="No limit" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="minOrderAmount">Min Order Amount</Label>
                                <Input id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" defaultValue={promo?.minOrderAmount ?? ""} disabled={isPending} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label>Start Date *</Label>
                                <DatePicker
                                    name="startDate"
                                    value={promo?.startDate ? new Date(promo.startDate).toISOString().split("T")[0] : undefined}
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date *</Label>
                                <DatePicker
                                    name="endDate"
                                    value={promo?.endDate ? new Date(promo.endDate).toISOString().split("T")[0] : undefined}
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        {promo && (
                            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                                <Switch
                                    name="isActiveToggle"
                                    defaultChecked={promo.isActive}
                                    onCheckedChange={(checked) => {
                                        const el = document.getElementById("isActiveHidden") as HTMLInputElement;
                                        if (el) el.value = checked ? "true" : "false";
                                    }}
                                />
                                <input type="hidden" id="isActiveHidden" name="isActiveHidden" defaultValue={promo.isActive ? "true" : "false"} />
                                <Label className="cursor-pointer">Active</Label>
                                <span className="text-xs text-muted-foreground">Toggle to activate or deactivate this promo</span>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={goBack} disabled={isPending}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {promo ? "Update Promo" : "Create Promo"}
                            </Button>
                        </div>
                    </div>

                    {/* Right — location selection */}
                    <div className="w-72 shrink-0 sticky top-4 max-h-[calc(100vh-5rem)] flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
                            <MapPin className="h-4 w-4" />
                            Assign Locations
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
        </div>
    );
}
