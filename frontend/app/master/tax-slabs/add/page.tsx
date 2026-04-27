"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createTaxSlabs } from "@/lib/actions/tax-slab";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

interface TaxSlabRow {
  id: number;
  name: string;
  minAmount: string;
  maxAmount: string;
  rate: string;
}

export default function AddTaxSlabPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [taxSlabs, setTaxSlabs] = useState<TaxSlabRow[]>([
    { id: 1, name: "", minAmount: "", maxAmount: "", rate: "" },
  ]);

  const addRow = () => {
    setTaxSlabs([
      ...taxSlabs,
      { id: Date.now(), name: "", minAmount: "", maxAmount: "", rate: "" },
    ]);
  };

  const removeRow = (id: number) => {
    if (taxSlabs.length > 1) setTaxSlabs(taxSlabs.filter((t) => t.id !== id));
  };

  const updateField = (id: number, field: keyof TaxSlabRow, value: string) => {
    setTaxSlabs(
      taxSlabs.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = taxSlabs
      .filter((t) => t.name.trim() && t.minAmount && t.maxAmount && t.rate)
      .map((t) => ({
        name: t.name.trim(),
        minAmount: parseFloat(t.minAmount),
        maxAmount: parseFloat(t.maxAmount),
        rate: parseFloat(t.rate),
      }));

    if (items.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await createTaxSlabs(items);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/tax-slabs/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/tax-slabs/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Tax Slabs</CardTitle>
          <CardDescription>Create one or more tax slabs</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {taxSlabs.map((ts, index) => (
              <div key={ts.id} className="space-y-4 border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-medium">
                    Tax Slab {index + 1}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(ts.id)}
                    disabled={taxSlabs.length === 1 || isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Name *</Label>
                    <Input
                      placeholder="Tax slab name"
                      value={ts.name}
                      onChange={(e) =>
                        updateField(ts.id, "name", e.target.value)
                      }
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Amount *</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={ts.minAmount}
                      onChange={(e) =>
                        updateField(ts.id, "minAmount", e.target.value)
                      }
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Amount *</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={ts.maxAmount}
                      onChange={(e) =>
                        updateField(ts.id, "maxAmount", e.target.value)
                      }
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Rate (%) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="5"
                      value={ts.rate}
                      onChange={(e) =>
                        updateField(ts.id, "rate", e.target.value)
                      }
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create{" "}
                  {taxSlabs.length > 1
                    ? `${taxSlabs.length} Tax Slabs`
                    : "Tax Slab"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    startTransition(() => {
                      addTransitionType("nav-back");
                      router.back();
                    });
                  }}
                >
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
  );
}
