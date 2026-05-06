"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createGenders } from "@/lib/actions/gender";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddGenderPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [genders, setGenders] = useState([{ id: 1, name: "", status: "active" }]);

    const addRow = () => {
        setGenders([...genders, { id: Date.now(), name: "", status: "active" }]);
    };

    const removeRow = (id: number) => {
        if (genders.length > 1) {
            setGenders(genders.filter((d) => d.id !== id));
        }
    };

    const updateName = (id: number, name: string) => {
        setGenders(genders.map((d) => (d.id === id ? { ...d, name } : d)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validGenders = genders.filter((d) => d.name.trim());

        if (validGenders.length === 0) {
            toast.error("Please enter at least one gender name");
            return;
        }

        startTransition(async () => {
            const items = validGenders.map((d) => ({
                name: d.name.trim(),
                status: d.status,
            }));

            const result = await createGenders(items);
            if (result.status) {
                toast.success(result.message || "Genders created successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/gender/list");
                });
            } else {
                toast.error(result.message || "Failed to create genders");
            }
        });
    };

    return (
        <PermissionGuard permissions="master.gender.create">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/master/gender/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add Genders</CardTitle>
                        <CardDescription>Create one or more Genders</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-3">
                                <Label>Genders</Label>
                                {genders.map((gender, index) => (
                                    <div key={gender.id} className="space-y-2 p-4 border rounded-md">
                                        <div className="flex gap-2 items-start">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Name</Label>
                                                    <Input
                                                        placeholder={`Gender Name`}
                                                        value={gender.name}
                                                        onChange={(e) => updateName(gender.id, e.target.value)}
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeRow(gender.id)}
                                                disabled={genders.length === 1 || isPending}
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
                                        Create {genders.length > 1 ? `${genders.length} Genders` : "Gender"}
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
