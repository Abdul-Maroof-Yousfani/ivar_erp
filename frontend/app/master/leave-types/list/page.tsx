import { getLeaveTypes } from "@/lib/actions/leave-type";
import { LeaveTypeList } from "./leave-type-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function LeaveTypeListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getLeaveTypes();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load leave types"
          message={result.message || "Unable to fetch leave types. Please check your connection and try again."}
        />
      );
    }

    return <LeaveTypeList initialLeaveTypes={result.data || []} newItemId={newItemId} />;
  } catch (error) {
    console.error("Error in LeaveTypeListPage:", error);
    return (
      <ListError
        title="Failed to load leave types"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
