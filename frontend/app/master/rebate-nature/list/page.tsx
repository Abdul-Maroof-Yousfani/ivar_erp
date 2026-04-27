import { getRebateNatures } from "@/lib/actions/rebate-nature";
import { RebateNatureList } from "./rebate-nature-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function RebateNatureListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getRebateNatures();
    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load rebate natures"
          message={result.message || "Unable to fetch data."}
        />
      );
    }

    return (
      <RebateNatureList
        initialRebateNatures={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in RebateNatureListPage:", error);
    return (
      <ListError
        title="Failed to load rebate natures"
        message={error instanceof Error ? error.message : "An unexpected error occurred."}
      />
    );
  }
}
