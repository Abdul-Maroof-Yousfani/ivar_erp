"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSilhouettes } from "@/lib/actions/silhouette";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddSilhouettePage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [silhouettes, setSilhouettes] = useState([{ id: 1, name: "", status: "active" }]);

    const addRow = () => {
        setSilhouettes([...silhouettes, { id: Date.now(), name: "", status: "active" }]);
    };

    const removeRow = (id: number) => {
        if (silhouettes.length > 1) {
            setSilhouettes(silhouettes.filter((d) => d.id !== id));
        }
    };

    const updateName = (id: number, name: string) => {
        setSilhouettes(silhouettes.map((d) => (d.id === id ? { ...d, name } : d)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validSilhouettes = silhouettes.filter((d) => d.name.trim());

        if (validSilhouettes.length === 0) {
            toast.error("Please enter at least one silhouette name");
            return;
        }

        startTransition(async () => {
            const items = validSilhouettes.map((d) => ({
                name: d.name.trim(),
                status: d.status,
            }));

            const result = await createSilhouettes(items);
            if (result.status) {
                toast.success(result.message || "Silhouettes created successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/silhouette/list");
                });
            } else {
                toast.error(result.message || "Failed to create silhouettes");
            }
        });
    };

    return (
        <PermissionGuard permissions="master.silhouette.create">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/master/silhouette/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add Silhouettes</CardTitle>
                        <CardDescription>Create one or more Silhouettes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-3">
                                <Label>Silhouettes</Label>
                                {silhouettes.map((silhouette, index) => (
                                    <div key={silhouette.id} className="space-y-2 p-4 border rounded-md">
                                        <div className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Name</Label>
                                                    <Input
                                                        placeholder={`Silhouette Name`}
                                                        value={silhouette.name}
                                                        onChange={(e) => updateName(silhouette.id, e.target.value)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeRow(silhouette.id)}
                                                disabled={silhouettes.length === 1 || isPending}
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
                                        Create {silhouettes.length > 1 ? `${silhouettes.length} Silhouettes` : "Silhouette"}
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
