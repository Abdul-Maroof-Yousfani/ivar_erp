import { getCategories } from "@/lib/actions/category";
import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { CategoryList } from "../../category/list/category-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function SubCategoryListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    
    // Fetch categories and chart of accounts in parallel
    const [catResult, coaResult] = await Promise.all([
      getCategories('sub'),
      getChartOfAccounts()
    ]);
    
    if (!catResult.status || !catResult.data) {
      return (
        <ListError
          title="Failed to load sub-categories"
          message={catResult.message || "Unable to fetch sub-categories."}
        />
      );
    }

    // Map account head names
    const accounts = coaResult.status ? coaResult.data : [];
    const categoriesWithAccountHeads = catResult.data.map(cat => {
      const account = accounts.find(a => a.id === cat.accountHeadId);
      return {
        ...cat,
        accountHeadName: account ? `${account.code} - ${account.name}` : "-"
      };
    });

    return (
      <PermissionGuard permissions="master.sub-category.read">
        <CategoryList
          initialCategories={categoriesWithAccountHeads}
          newItemId={newItemId}
          isSubCategory={true}
        />
      </PermissionGuard>
    );
  } catch (error) {
    console.error("Error in SubCategoryListPage:", error);
    return (
      <ListError
        title="Failed to load sub-categories"
        message={error instanceof Error ? error.message : "An unexpected error occurred."}
      />
    );
  }
}
