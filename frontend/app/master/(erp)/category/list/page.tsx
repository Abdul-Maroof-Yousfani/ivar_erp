import { getCategories } from "@/lib/actions/category";
import { CategoryList } from "./category-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function CategoryListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getCategories();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load categories"
          message={result.message || "Unable to fetch categories. Please check your connection and try again."}
        />
      );
    }

    return (
      <PermissionGuard permissions="master.category.read">
        <CategoryList
          initialCategories={result.data || []}
          newItemId={newItemId}
          isSubCategory={false}
        />
      </PermissionGuard>
    );
  } catch (error) {
    console.error("Error in CategoryListPage:", error);
    return (
      <ListError
        title="Failed to load categories"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
