"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createBonusTypes } from "@/lib/actions/bonus-type";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, Gift } from "lucide-react";
import Link from "next/link";

type BonusTypeItem = {
  id: number;
  name: string;
  calculationType: string;
  amount: string;
  percentage: string;
};

export default function AddBonusTypePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<BonusTypeItem[]>([{ id: 1, name: "", calculationType: "Amount", amount: "", percentage: "" }]);

  const addRow = () => {
    setItems([...items, { id: Date.now(), name: "", calculationType: "Amount", amount: "", percentage: "" }]);
  };

  const removeRow = (id: number) => {
    if (items.length > 1) setItems(items.filter((it) => it.id !== id));
  };

  const updateItem = (id: number, field: keyof BonusTypeItem, value: string) => {
    setItems((prevItems) => 
      prevItems.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const updateCalculationType = (id: number, value: string) => {
    setItems((prevItems) =>
      prevItems.map((it) => {
        if (it.id === id) {
          return {
            ...it,
            calculationType: value,
            amount: value === "Amount" ? it.amount : "",
            percentage: value === "Percentage" ? it.percentage : "",
          };
        }
        return it;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = items
      .map((it) => {
        const item: any = {
          name: it.name.trim(),
          calculationType: it.calculationType || "Amount",
        };
        if (it.calculationType === "Amount" && it.amount) {
          item.amount = parseFloat(it.amount);
        } else if (it.calculationType === "Percentage" && it.percentage) {
          item.percentage = parseFloat(it.percentage);
        }
        return item;
      })
      .filter((it) => it.name);
    
    if (!payload.length) {
      toast.error("Please enter at least one bonus type name");
      return;
    }

    // Validate required fields
    for (const item of payload) {
      if (item.calculationType === "Amount" && !item.amount) {
        toast.error(`Amount is required for "${item.name}" when calculation type is Amount`);
        return;
      }
      if (item.calculationType === "Percentage" && !item.percentage) {
        toast.error(`Percentage is required for "${item.name}" when calculation type is Percentage`);
        return;
      }
    }

    startTransition(async () => {
      const result = await createBonusTypes(payload);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/bonus-types/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/master/bonus-types/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Add Bonus Types
          </CardTitle>
          <CardDescription>Create one or more bonus types for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-5 bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                        {index + 1}
                      </div>
                      <Label className="text-base font-semibold">Bonus Type {index + 1}</Label>
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(item.id)}
                        disabled={isPending}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Compact Horizontal Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bonus Name */}
                    <div className="space-y-2">
                      <Label htmlFor={`name-${item.id}`} className="text-sm font-medium">
                        Bonus Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`name-${item.id}`}
                        placeholder="Enter bonus type name"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        disabled={isPending}
                        required
                        className="h-10"
                      />
                    </div>

                    {/* Calculation Type Radio Buttons */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Calculation Type <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center h-10 border rounded-md px-3 bg-background">
                        <RadioGroup
                          value={item.calculationType}
                          onValueChange={(value) => {
                            updateCalculationType(item.id, value);
                          }}
                          disabled={isPending}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Amount" id={`calc-amount-${item.id}`} />
                            <Label htmlFor={`calc-amount-${item.id}`} className="cursor-pointer font-normal text-sm">
                              Amount
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Percentage" id={`calc-percentage-${item.id}`} />
                            <Label htmlFor={`calc-percentage-${item.id}`} className="cursor-pointer font-normal text-sm">
                              Percent
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    {/* Amount or Percentage Input */}
                    <div className="space-y-2">
                      {item.calculationType === "Amount" ? (
                        <>
                          <Label htmlFor={`amount-${item.id}`} className="text-sm font-medium">
                            Amount <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`amount-${item.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.amount}
                            onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                            disabled={isPending}
                            required
                            className="h-10"
                          />
                        </>
                      ) : (
                        <>
                          <Label htmlFor={`percentage-${item.id}`} className="text-sm font-medium">
                            Percentage <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`percentage-${item.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="0.00"
                            value={item.percentage}
                            onChange={(e) => updateItem(item.id, "percentage", e.target.value)}
                            disabled={isPending}
                            required
                            className="h-10"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center pt-4 border-t">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending} size="lg">
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create {items.length > 1 ? `${items.length} Bonus Types` : "Bonus Type"}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  startTransition(() => {
                    addTransitionType("nav-back");
                    router.back();
                  });
                }} size="lg" disabled={isPending}>
                  Cancel
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={addRow}
                disabled={isPending}
                className="text-primary hover:text-primary hover:bg-primary/10"
              >
                <Gift className="h-4 w-4 mr-2" />
                Add More Bonus Type
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

