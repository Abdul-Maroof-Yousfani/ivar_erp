"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { categoryColumns, subCategoryColumns, CategoryRow } from "./columns";
import {
  Category,
  deleteCategory,
  updateCategory,
} from "@/lib/actions/category";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CategoryListProps {
  initialCategories: Category[];
  newItemId?: string;
  isSubCategory?: boolean;
}

export function CategoryList({
  initialCategories,
  newItemId,
  isSubCategory = false,
}: CategoryListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push(isSubCategory ? "/master/sub-category/add" : "/master/category/add");
    });
  };

  const readPermission = isSubCategory ? "master.sub-category.read" : "master.category.read";
  const createPermission = isSubCategory ? "master.sub-category.create" : "master.category.create";
  const updatePermission = isSubCategory ? "master.sub-category.update" : "master.category.update";
  const deletePermission = isSubCategory ? "master.sub-category.delete" : "master.category.delete";

  const showAddAction = hasPermission(createPermission);
  const canBulkEdit = false; // Disable bulk edit for categories for now
  const canBulkDelete = hasPermission(deletePermission);

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      // Need to implement multi-delete action if needed, or loop
      for (const id of ids) {
        await deleteCategory(id);
      }
      toast.success("Categories deleted successfully");
      router.refresh();
    });
  };

  const data: CategoryRow[] = initialCategories;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {isSubCategory ? "Sub Categories" : "Categories"}
        </h2>
        <p className="text-muted-foreground">
          Manage your organization {isSubCategory ? "sub-categories" : "categories"}
        </p>
      </div>

      <DataTable<CategoryRow>
        columns={isSubCategory ? subCategoryColumns : categoryColumns}
        data={data}
        actionText={showAddAction ? (isSubCategory ? "Add Sub Category" : "Add Category") : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[{ key: "name", label: "Name" }]}
        onMultiDelete={handleMultiDelete}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId={isSubCategory ? "sub-category-list" : "category-list"}
      />
    </div>
  );
}
