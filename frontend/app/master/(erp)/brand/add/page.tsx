"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrands } from "@/lib/actions/brand";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddBrandPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [brands, setBrands] = useState([{ id: 1, name: "", status: "active" }]);

    const addRow = () => {
        setBrands([...brands, { id: Date.now(), name: "", status: "active" }]);
    };

    const removeRow = (id: number) => {
        if (brands.length > 1) {
            setBrands(brands.filter((d) => d.id !== id));
        }
    };

    const updateName = (id: number, name: string) => {
        setBrands(brands.map((d) => (d.id === id ? { ...d, name } : d)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validBrands = brands.filter((d) => d.name.trim());

        if (validBrands.length === 0) {
            toast.error("Please enter at least one brand name");
            return;
        }

        startTransition(async () => {
            const items = validBrands.map((d) => ({
                name: d.name.trim(),
                status: d.status,
            }));

            const result = await createBrands(items);
            if (result.status) {
                toast.success(result.message || "Brands created successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/brand/list");
                });
            } else {
                toast.error(result.message || "Failed to create brands");
            }
        });
    };

    return (
        <PermissionGuard permissions="master.brand.create">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/master/brand/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add Brands</CardTitle>
                        <CardDescription>Create one or more brands</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-3">
                                <Label>Brands</Label>
                                {brands.map((brand, index) => (
                                    <div key={brand.id} className="space-y-2 p-4 border rounded-md">
                                        <div className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Name</Label>
                                                    <Input
                                                        placeholder={`Brand Name`}
                                                        value={brand.name}
                                                        onChange={(e) => updateName(brand.id, e.target.value)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeRow(brand.id)}
                                                disabled={brands.length === 1 || isPending}
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
                                        Create {brands.length > 1 ? `${brands.length} Brands` : "Brand"}
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
