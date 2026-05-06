import { getSalaryBreakups } from "@/lib/actions/salary-breakup";
import { SalaryBreakupList } from "./salary-breakup-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function SalaryBreakupListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getSalaryBreakups();
    console.log(result);
    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load salary breakups"
          message={result.message || "Unable to fetch salary breakups. Please check your connection and try again."}
        />
      );
    }

    return <SalaryBreakupList initialSalaryBreakups={result.data || []} newItemId={newItemId} />;
  } catch (error) {
    console.error("Error in SalaryBreakupListPage:", error);
    return (
      <ListError
        title="Failed to load salary breakups"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

