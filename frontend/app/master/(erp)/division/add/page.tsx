"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createDivisions } from "@/lib/actions/division";
import { getBrands, Brand } from "@/lib/actions/brand";
import { Autocomplete } from "@/components/ui/autocomplete";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddDivisionPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [divisions, setDivisions] = useState([{ id: 1, name: "", brandId: "" }]);
    const [brands, setBrands] = useState<Brand[]>([]);

    useEffect(() => {
        getBrands().then((result) => {
            if (result.status && result.data) {
                setBrands(result.data);
            }
        });
    }, []);

    const addRow = () => {
        setDivisions([...divisions, { id: Date.now(), name: "", brandId: "" }]);
    };

    const removeRow = (id: number) => {
        if (divisions.length > 1) {
            setDivisions(divisions.filter((d) => d.id !== id));
        }
    };

    const updateName = (id: number, name: string) => {
        setDivisions(divisions.map((d) => (d.id === id ? { ...d, name } : d)));
    };

    const updateBrandId = (id: number, brandId: string) => {
        setDivisions(divisions.map((d) => (d.id === id ? { ...d, brandId } : d)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validDivisions = divisions.filter((d) => d.name.trim() && d.brandId);

        if (validDivisions.length === 0) {
            toast.error("Please enter name and select brand for all items");
            return;
        }

        startTransition(async () => {
            const items = validDivisions.map((d) => ({
                name: d.name.trim(),
                brandId: d.brandId,
            }));

            const result = await createDivisions(items);
            if (result.status) {
                toast.success(result.message || "Divisions created successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/division/list");
                });
            } else {
                toast.error(result.message || "Failed to create divisions");
            }
        });
    };

    return (
        <PermissionGuard permissions="master.division.create">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/master/division/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add Divisions</CardTitle>
                        <CardDescription>Create one or more divisions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-3">
                                <Label>Divisions</Label>
                                {divisions.map((division, index) => (
                                    <div key={division.id} className="space-y-2 p-4 border rounded-md">
                                        <div className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Name</Label>
                                                    <Input
                                                        placeholder={`Division Name`}
                                                        value={division.name}
                                                        onChange={(e) => updateName(division.id, e.target.value)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Brand</Label>
                                                    <Autocomplete
                                                        options={brands.map(b => ({ value: b.id, label: b.name }))}
                                                        value={division.brandId}
                                                        onValueChange={(val) => updateBrandId(division.id, val)}
                                                        placeholder="Select brand"
                                                        searchPlaceholder="Search brand..."
                                                        emptyMessage="No brands found"
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeRow(division.id)}
                                                disabled={divisions.length === 1 || isPending}
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
                                        Create {divisions.length > 1 ? `${divisions.length} Divisions` : "Division"}
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
