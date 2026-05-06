"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSizes } from "@/lib/actions/size";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddSizePage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [sizes, setSizes] = useState([{ id: 1, name: "", status: "active" }]);

    const addRow = () => {
        setSizes([...sizes, { id: Date.now(), name: "", status: "active" }]);
    };

    const removeRow = (id: number) => {
        if (sizes.length > 1) {
            setSizes(sizes.filter((d) => d.id !== id));
        }
    };

    const updateName = (id: number, name: string) => {
        setSizes(sizes.map((d) => (d.id === id ? { ...d, name } : d)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validSizes = sizes.filter((d) => d.name.trim());

        if (validSizes.length === 0) {
            toast.error("Please enter at least one size name");
            return;
        }

        startTransition(async () => {
            const items = validSizes.map((d) => ({
                name: d.name.trim(),
                status: d.status,
            }));

            const result = await createSizes(items);
            if (result.status) {
                toast.success(result.message || "Sizes created successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/size/list");
                });
            } else {
                toast.error(result.message || "Failed to create sizes");
            }
        });
    };

    return (
        <PermissionGuard permissions="master.size.create">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/master/size/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add Sizes</CardTitle>
                        <CardDescription>Create one or more Sizes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-3">
                                <Label>Sizes</Label>
                                {sizes.map((size, index) => (
                                    <div key={size.id} className="space-y-2 p-4 border rounded-md">
                                        <div className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Name</Label>
                                                    <Input
                                                        placeholder={`Size Name`}
                                                        value={size.name}
                                                        onChange={(e) => updateName(size.id, e.target.value)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeRow(size.id)}
                                                disabled={sizes.length === 1 || isPending}
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
                                        Create {sizes.length > 1 ? `${sizes.length} Sizes` : "Size"}
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
