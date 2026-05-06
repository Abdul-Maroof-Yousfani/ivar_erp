"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, addTransitionType } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategory, getCategories, Category } from "@/lib/actions/category";
import { getChartOfAccounts, ChartOfAccount } from "@/lib/actions/chart-of-account";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddSubCategoryPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [subCategories, setSubCategories] = useState([
    { id: 1, name: "", parentId: "", accountHeadId: "" },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [catResult, accResult] = await Promise.all([
          getCategories(),
          getChartOfAccounts(),
        ]);

        if (catResult.status) setParentCategories(catResult.data);
        if (accResult.status) setAccounts(accResult.data);
      } catch (error) {
        toast.error("Failed to load dependency data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const addRow = () => {
    setSubCategories([
      ...subCategories,
      { id: Date.now(), name: "", parentId: "", accountHeadId: "" },
    ]);
  };

  const removeRow = (id: number) => {
    if (subCategories.length > 1) {
      setSubCategories(subCategories.filter((s) => s.id !== id));
    }
  };

  const updateField = (id: number, field: string, value: string) => {
    setSubCategories(
      subCategories.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = subCategories.filter((s) => s.name.trim() && s.parentId);

    if (items.length === 0) {
      toast.error("Please enter sub-category name and select parent Category");
      return;
    }

    startTransition(async () => {
      let successCount = 0;
      for (const item of items) {
        const result = await createCategory({
          name: item.name.trim(),
          parentId: item.parentId,
          accountHeadId: item.accountHeadId || undefined,
        });
        if (result.status) {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} sub-categories`);
        addTransitionType("nav-back");
        router.push("/master/sub-category/list");
      } else {
        toast.error("Failed to create sub-categories");
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PermissionGuard permissions="master.sub-category.create">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/master/sub-category/list" transitionTypes={["nav-back"]}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Sub Categories</CardTitle>
            <CardDescription>
              Create sub-categories linked to parent categories and account heads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 px-2 italic text-sm text-muted-foreground">
                  <div>Parent Category *</div>
                  <div>Name *</div>
                  <div>Account Head</div>
                </div>
                {subCategories.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <Select
                        value={item.parentId}
                        onValueChange={(v) => updateField(item.id, "parentId", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Parent" />
                        </SelectTrigger>
                        <SelectContent>
                          {parentCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Sub Category Name"
                        value={item.name}
                        onChange={(e) => updateField(item.id, "name", e.target.value)}
                        disabled={isPending}
                      />

                      <Select
                        value={item.accountHeadId}
                        onValueChange={(v) => updateField(item.id, "accountHeadId", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(item.id)}
                      disabled={subCategories.length === 1 || isPending}
                      className="mt-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-between">
                <div className="flex gap-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Create{" "}
                    {subCategories.length > 1
                      ? `${subCategories.length} Sub Categories`
                      : "Sub Category"}
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
    </PermissionGuard>
  );
}
