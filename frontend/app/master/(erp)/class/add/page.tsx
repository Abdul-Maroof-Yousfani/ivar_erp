"use client";

import { useId, useState, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { createItemClasses } from "@/lib/actions/item-class";

export default function AddClassPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [items, setItems] = useState([{ name: "", status: "active" }]);

    const addItem = () => {
        setItems([...items, { name: "", status: "active" }]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validItems = items.filter(item => item.name.trim() !== "");
        if (validItems.length === 0) {
            toast.error("Please add at least one item class with a name");
            return;
        }

        startTransition(async () => {
            const result = await createItemClasses(validItems);
            if (result.status) {
                toast.success(result.message);
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/class/list");
                });
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <PermissionGuard permissions="master.item-class.create">
            <div className="p-6">
                <form onSubmit={onSubmit}>
                    <Card className="max-w-4xl mx-auto">
                        <CardHeader>
                            <CardTitle>Add New Item Classes</CardTitle>
                            <CardDescription>Add one or more item classes in bulk.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {items.map((item, index) => (
                                <div key={index} className="flex flex-col gap-4 p-4 border rounded-lg relative bg-muted/30">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`name-${index}`}>Class Name</Label>
                                            <Input
                                                id={`name-${index}`}
                                                placeholder="e.g. Shirts, Pants"
                                                value={item.name}
                                                onChange={(e) => updateItem(index, "name", e.target.value)}
                                                disabled={isPending}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`status-${index}`}>Status</Label>
                                            <Select
                                                value={item.status}
                                                onValueChange={(value) => updateItem(index, "status", value)}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger id={`status-${index}`}>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {items.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute -top-2 -right-2 bg-background border shadow-sm rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => removeItem(index)}
                                            disabled={isPending}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </div>
                            ))}

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-dashed"
                                onClick={addItem}
                                disabled={isPending}
                            >
                                <Plus size={16} className="mr-2" />
                                Add Another Item
                            </Button>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t p-6">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    startTransition(() => {
                                        addTransitionType("nav-back");
                                        router.back();
                                    });
                                }}
                                disabled={isPending}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} className="mr-2" />
                                        Save Item Classes
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </div>
        </PermissionGuard>
    );
}
