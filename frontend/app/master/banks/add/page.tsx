"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBanks } from "@/lib/actions/bank";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, Building2, Plus } from "lucide-react";
import Link from "next/link";

type BankItem = {
  id: number;
  name: string;
  code: string;
  accountNumberPrefix: string;
};

export default function AddBankPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<BankItem[]>([{ id: 1, name: "", code: "", accountNumberPrefix: "" }]);

  const addRow = () => {
    setItems([...items, { id: Date.now(), name: "", code: "", accountNumberPrefix: "" }]);
  };

  const removeRow = (id: number) => {
    if (items.length > 1) setItems(items.filter((it) => it.id !== id));
  };

  const updateItem = (id: number, field: keyof BankItem, value: string) => {
    setItems((prevItems) => 
      prevItems.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = items
      .map((it) => ({
        name: it.name.trim(),
        code: it.code.trim() || undefined,
        accountNumberPrefix: it.accountNumberPrefix.trim() || undefined,
      }))
      .filter((it) => it.name);
    
    if (!payload.length) {
      toast.error("Please enter at least one bank name");
      return;
    }

    startTransition(async () => {
      const result = await createBanks(payload);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/banks/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/master/banks/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add Banks
          </CardTitle>
          <CardDescription>Create one or more banks for your organization</CardDescription>
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
                      <Label className="text-base font-semibold">Bank {index + 1}</Label>
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${item.id}`} className="text-sm font-medium">
                        Bank Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`name-${item.id}`}
                        placeholder="Enter bank name"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        disabled={isPending}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`code-${item.id}`} className="text-sm font-medium">
                        Bank Code
                      </Label>
                      <Input
                        id={`code-${item.id}`}
                        placeholder="e.g., HBL, MCB"
                        value={item.code}
                        onChange={(e) => updateItem(item.id, "code", e.target.value)}
                        disabled={isPending}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`prefix-${item.id}`} className="text-sm font-medium">
                        Account Prefix
                      </Label>
                      <Input
                        id={`prefix-${item.id}`}
                        placeholder="e.g., HBL, MCB"
                        value={item.accountNumberPrefix}
                        onChange={(e) => updateItem(item.id, "accountNumberPrefix", e.target.value)}
                        disabled={isPending}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center pt-4 border-t">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending} size="lg">
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create {items.length > 1 ? `${items.length} Banks` : "Bank"}
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
                <Plus className="h-4 w-4 mr-2" />
                Add More Bank
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

