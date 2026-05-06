import { getProvidentFunds } from "@/lib/actions/provident-fund";
import { ProvidentFundList } from "./provident-fund-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function ProvidentFundListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getProvidentFunds();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load provident funds"
          message={result.message || "Unable to fetch provident funds. Please check your connection and try again."}
        />
      );
    }

    return (
      <ProvidentFundList
        initialProvidentFunds={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in ProvidentFundListPage:", error);
    return (
      <ListError
        title="Failed to load provident funds"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

