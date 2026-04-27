"use client";

import { useState, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowLeft } from "lucide-react";
import { createAllocations } from "@/lib/actions/allocation";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddAllocationPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [allocations, setAllocations] = useState<string[]>([""]);

    const addField = () => {
        setAllocations([...allocations, ""]);
    };

    const removeField = (index: number) => {
        if (allocations.length > 1) {
            setAllocations(allocations.filter((_, i) => i !== index));
        }
    };

    const updateName = (index: number, value: string) => {
        const newAllocations = [...allocations];
        newAllocations[index] = value;
        setAllocations(newAllocations);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const names = allocations.filter((name) => name.trim() !== "");

        if (names.length === 0) {
            toast.error("Please enter at least one allocation name");
            return;
        }

        startTransition(async () => {
            const result = await createAllocations(names);
            if (result.status) {
                toast.success(result.message);
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/allocation/list");
                });
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <PermissionGuard permissions="allocation.create">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            startTransition(() => {
                                addTransitionType("nav-back");
                                router.back();
                            });
                        }}
                        className="rounded-full"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Add Allocations</h2>
                        <p className="text-muted-foreground">Add new allocations in bulk</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Allocation Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-3">
                                {allocations.map((name, index) => (
                                    <div key={index} className="flex gap-2">
                                        <div className="flex-1 space-y-2">
                                            <Label htmlFor={`name-${index}`} className="sr-only">
                                                Allocation Name
                                            </Label>
                                            <Input
                                                id={`name-${index}`}
                                                placeholder={`Enter allocation name ${index + 1}`}
                                                value={name}
                                                onChange={(e) => updateName(index, e.target.value)}
                                                disabled={isPending}
                                                required
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeField(index)}
                                            disabled={isPending || allocations.length === 1}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={addField}
                                    disabled={isPending}
                                    className="w-full sm:w-auto"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add More
                                </Button>
                                <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save Allocations
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </PermissionGuard>
    );
}
