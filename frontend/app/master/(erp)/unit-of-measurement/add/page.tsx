"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createUnitsOfMeasurement } from "@/lib/actions/unit-of-measurement";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddUnitOfMeasurementPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [units, setUnits] = useState([{ id: 1, name: "", abbreviation: "", status: "active" }]);

    const addRow = () => {
        setUnits([...units, { id: Date.now(), name: "", abbreviation: "", status: "active" }]);
    };

    const removeRow = (id: number) => {
        if (units.length > 1) {
            setUnits(units.filter((d) => d.id !== id));
        }
    };

    const updateField = (id: number, field: "name" | "abbreviation", value: string) => {
        setUnits(units.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validUnits = units.filter((d) => d.name.trim() && d.abbreviation.trim());

        if (validUnits.length === 0) {
            toast.error("Please enter at least one unit of measurement");
            return;
        }

        startTransition(async () => {
            const items = validUnits.map((d) => ({
                name: d.name.trim(),
                abbreviation: d.abbreviation.trim(),
                status: d.status,
            }));

            const result = await createUnitsOfMeasurement(items);
            if (result.status) {
                toast.success(result.message || "Units of measurement created successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/unit-of-measurement/list");
                });
            } else {
                toast.error(result.message || "Failed to create units of measurement");
            }
        });
    };

    return (
        <PermissionGuard permissions="master.unit-of-measurement.create">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/master/unit-of-measurement/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add Units of Measurement</CardTitle>
                        <CardDescription>Create one or more units of measurement</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-3">
                                <Label>Units of Measurement</Label>
                                {units.map((unit, index) => (
                                    <div key={unit.id} className="space-y-2 p-4 border rounded-md">
                                        <div className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Name *</Label>
                                                    <Input
                                                        placeholder="Kilogram"
                                                        value={unit.name}
                                                        onChange={(e) => updateField(unit.id, "name", e.target.value)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Abbreviation *</Label>
                                                    <Input
                                                        placeholder="kg"
                                                        value={unit.abbreviation}
                                                        onChange={(e) => updateField(unit.id, "abbreviation", e.target.value)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeRow(unit.id)}
                                                disabled={units.length === 1 || isPending}
                                                className="mt-6"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 justify-between">
                                <div className="flex gap-2">
                                    <Button type="submit" disabled={isPending}>
                                        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Create {units.length > 1 ? `${units.length} Units` : "Unit"}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => {
                                        startTransition(() => {
                                            addTransitionType("nav-back");
                                            router.back();
                                        });
                                    }}>
                                        Cancel
                                    </Button>
                                </div>
                                <button
                                    type="button"
                                    onClick={addRow}
                                    disabled={isPending}
                                    className="text-sm text-primary hover:underline disabled:opacity-50"
                                >
                                    + Add more
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </PermissionGuard>
    );
}
