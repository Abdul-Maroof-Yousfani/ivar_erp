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
import { createCategory } from "@/lib/actions/category";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddCategoryPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setCategories([...categories, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (categories.length > 1) {
      setCategories(categories.filter((c) => c.id !== id));
    }
  };

  const updateField = (id: number, value: string) => {
    setCategories(
      categories.map((c) => (c.id === id ? { ...c, name: value } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = categories.filter((c) => c.name.trim());

    if (items.length === 0) {
      toast.error("Please enter at least one category name");
      return;
    }

    startTransition(async () => {
      let successCount = 0;
      for (const item of items) {
        const result = await createCategory({
          name: item.name.trim(),
        });
        if (result.status) {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} categories`);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/category/list");
        });
      } else {
        toast.error("Failed to create categories");
      }
    });
  };

  return (
    <PermissionGuard permissions="master.category.create">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/master/category/list" transitionTypes={["nav-back"]}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Categories</CardTitle>
            <CardDescription>
              Create one or more top-level categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Category Names</Label>
                {categories.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <Input
                      placeholder={`Category ${index + 1}`}
                      value={item.name}
                      onChange={(e) => updateField(item.id, e.target.value)}
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(item.id)}
                      disabled={categories.length === 1 || isPending}
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
                    {categories.length > 1
                      ? `${categories.length} Categories`
                      : "Category"}
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
