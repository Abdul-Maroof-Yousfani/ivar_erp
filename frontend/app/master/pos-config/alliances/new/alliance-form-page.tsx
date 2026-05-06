"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, ArrowLeft, Handshake, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AllianceDiscount, createAlliance, updateAlliance } from "@/lib/actions/pos-config";
import { Location } from "@/lib/actions/location";
import { LocationMultiSelect } from "../../_components/location-multi-select";

interface Props {
    locations: Location[];
    alliance?: AllianceDiscount;
}

function toAllianceCode(name: string) {
    return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20);
}

export function AllianceFormPage({ locations, alliance }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [locationIds, setLocationIds] = useState<string[]>(
        alliance?.locations.map((l) => l.location.id) ?? []
    );
    const [codeValue, setCodeValue] = useState(alliance?.code ?? "");
    const [codeManual, setCodeManual] = useState(!!alliance);
    const [binInput, setBinInput] = useState((alliance?.binNumbers ?? []).join(", "));

    const goBack = () => {
        startTransition(() => {
            router.push("/master/pos-config/alliances");
        });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const isActiveHidden = fd.get("isActiveHidden");

        const binNumbers = binInput
            .split(/[\s,]+/)
            .map((b) => b.trim())
            .filter((b) => /^\d{4,8}$/.test(b));

        const invalidBins = binInput
            .split(/[\s,]+/)
            .map((b) => b.trim())
            .filter(Boolean)
            .filter((b) => !/^\d{4,8}$/.test(b));

        if (invalidBins.length > 0) {
            toast.error(`Invalid BINs: ${invalidBins.join(", ")}. Each must be 4–8 digits.`);
            return;
        }

        const data = {
            partnerName: fd.get("partnerName") as string,
            code: codeValue,
            discountPercent: Number(fd.get("discountPercent")),
            maxDiscount: fd.get("maxDiscount") ? Number(fd.get("maxDiscount")) : undefined,
            description: (fd.get("description") as string) || undefined,
            startDate: (fd.get("startDate") as string) || undefined,
            endDate: (fd.get("endDate") as string) || undefined,
            isActive: isActiveHidden !== null ? isActiveHidden === "true" : true,
            locationIds,
            binNumbers,
        };

        startTransition(async () => {
            const result = alliance
                ? await updateAlliance(alliance.id, data)
                : await createAlliance(data);
            if (result.status) {
                toast.success(result.message ?? (alliance ? "Alliance updated" : "Alliance created"));
                goBack();
            } else {
                toast.error(result.message);
            }
        });
    };

    const parsedBins = binInput.split(/[\s,]+/).filter(Boolean);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                    <Handshake className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-xl font-semibold">{alliance ? "Edit Alliance Discount" : "New Alliance Discount"}</h2>
                </div>
            </div>

            {/* Two-column layout */}
            <form onSubmit={handleSubmit}>
                <div className="flex gap-6 items-start">
                    {/* Left — form fields */}
                    <div className="flex-1 min-w-0 space-y-5 sticky top-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="partnerName">Partner Name *</Label>
                                <Input
                                    id="partnerName"
                                    name="partnerName"
                                    defaultValue={alliance?.partnerName}
                                    required
                                    disabled={isPending}
                                    onChange={(e) => {
                                        if (!codeManual) setCodeValue(toAllianceCode(e.target.value));
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">
                                    Code *
                                    {!codeManual && <span className="ml-1 text-xs text-muted-foreground font-normal">(auto-generated)</span>}
                                </Label>
                                <Input
                                    id="code"
                                    value={codeValue}
                                    onChange={(e) => { setCodeValue(e.target.value.toUpperCase()); setCodeManual(true); }}
                                    required
                                    disabled={isPending}
                                    className="uppercase"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="discountPercent">Discount % *</Label>
                                <Input id="discountPercent" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={alliance?.discountPercent} required disabled={isPending} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxDiscount">Max Discount Cap</Label>
                                <Input id="maxDiscount" name="maxDiscount" type="number" step="0.01" min="0" defaultValue={alliance?.maxDiscount ?? ""} disabled={isPending} placeholder="No cap" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input id="description" name="description" defaultValue={alliance?.description ?? ""} disabled={isPending} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <DatePicker
                                    name="startDate"
                                    value={alliance?.startDate ? new Date(alliance.startDate).toISOString().split("T")[0] : undefined}
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <DatePicker
                                    name="endDate"
                                    value={alliance?.endDate ? new Date(alliance.endDate).toISOString().split("T")[0] : undefined}
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bins">
                                BIN Numbers
                                <span className="ml-1 text-xs text-muted-foreground font-normal">(4–8 digits each, comma-separated)</span>
                            </Label>
                            <Input
                                id="bins"
                                placeholder="e.g. 52341234, 45678901, 12345678"
                                value={binInput}
                                onChange={(e) => setBinInput(e.target.value)}
                                disabled={isPending}
                            />
                            {parsedBins.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {parsedBins.map((bin, i) => (
                                        <Badge
                                            key={i}
                                            variant={/^\d{4,8}$/.test(bin.trim()) ? "outline" : "destructive"}
                                            className="font-mono text-[10px]"
                                        >
                                            {bin.trim()}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <p className="text-[11px] text-muted-foreground">
                                Cashiers can search alliances by typing the first digits of the card BIN at checkout.
                            </p>
                        </div>

                        {alliance && (
                            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                                <Switch
                                    defaultChecked={alliance.isActive}
                                    onCheckedChange={(checked) => {
                                        const el = document.getElementById("isActiveHidden") as HTMLInputElement;
                                        if (el) el.value = checked ? "true" : "false";
                                    }}
                                />
                                <input type="hidden" id="isActiveHidden" name="isActiveHidden" defaultValue={alliance.isActive ? "true" : "false"} />
                                <Label className="cursor-pointer">Active</Label>
                                <span className="text-xs text-muted-foreground">Toggle to activate or deactivate this alliance</span>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={goBack} disabled={isPending}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {alliance ? "Update Alliance" : "Create Alliance"}
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
