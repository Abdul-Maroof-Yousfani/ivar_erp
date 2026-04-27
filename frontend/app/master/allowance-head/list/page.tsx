import { getAllowanceHeads } from "@/lib/actions/allowance-head";
import { AllowanceHeadList } from "./allowance-head-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function AllowanceHeadListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getAllowanceHeads();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load allowance heads"
          message={result.message || "Unable to fetch allowance heads. Please check your connection and try again."}
        />
      );
    }

    return (
      <AllowanceHeadList
        initialAllowanceHeads={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in AllowanceHeadListPage:", error);
    return (
      <ListError
        title="Failed to load allowance heads"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

