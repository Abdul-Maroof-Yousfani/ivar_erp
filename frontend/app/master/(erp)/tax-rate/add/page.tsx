"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createTaxRate } from "@/lib/actions/tax-rate";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

type RowItem = {
  id: number;
  taxRate1: string;
};

export default function AddTaxRatePage() {
  const router = useRouter();
  const [items, setItems] = useState<RowItem[]>([{ id: 1, taxRate1: "" }]);
  const [isPending, startTransition] = useTransition();

  const addRow = () => {
    setItems((prev) => [...prev, { id: prev.length + 1, taxRate1: "" }]);
  };

  const removeRow = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateField = (id: number, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, taxRate1: value } : item)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payloads = items
        .map((i) => ({ taxRate1: parseFloat(i.taxRate1) }))
        .filter((i) => !Number.isNaN(i.taxRate1));

      if (payloads.length === 0) {
        toast.error("Please add at least one valid Tax Rate 1");
        return;
      }

      let lastCreatedId: string | undefined;
      for (const p of payloads) {
        const res = await createTaxRate(p);
        if (!res.status) {
          toast.error(res.message || "Failed to create Tax Rate");
          return;
        }
        lastCreatedId = res.data?.id;
      }
      toast.success("Tax Rate(s) created successfully");
      startTransition(() => {
        addTransitionType("nav-back");
        router.push(`/master/tax-rate/list${lastCreatedId ? `?newItemId=${lastCreatedId}` : ""}`);
      });
    });
  };

  return (
    <PermissionGuard permissions="master.tax-rate.create">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/master/tax-rate/list" transitionTypes={["nav-back"]}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Tax Rate 1</CardTitle>
            <CardDescription>Create one or more Tax Rate 1 values</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Tax Rate 1</Label>
                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-2 gap-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Tax Rate 1 ${index + 1}`}
                        type="number"
                        step="0.01"
                        value={item.taxRate1}
                        onChange={(e) => updateField(item.id, e.target.value)}
                        disabled={isPending}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(item.id)}
                        disabled={items.length === 1 || isPending}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={addRow} disabled={isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
