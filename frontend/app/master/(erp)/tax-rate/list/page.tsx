import { getTaxRates } from "@/lib/actions/tax-rate";
import { TaxRateList } from "./tax-rate-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function TaxRateListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getTaxRates();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load Tax Rates"
          message={result.message || "Unable to fetch tax rates."}
        />
      );
    }

    return (
      <PermissionGuard permissions="master.tax-rate.read">
        <TaxRateList initialItems={result.data || []} newItemId={newItemId} />
      </PermissionGuard>
    );
  } catch (error) {
    console.error("Error in TaxRateListPage:", error);
    return (
      <ListError
        title="Failed to load Tax Rates"
        message={error instanceof Error ? error.message : "An unexpected error occurred."}
      />
    );
  }
}
