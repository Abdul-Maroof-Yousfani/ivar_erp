import { LeaveEncashmentList } from "./leave-encashment-list";
import { ListError } from "@/components/dashboard/list-error";
import { getLeaveEncashments } from "@/lib/actions/leave-encashment";

export const dynamic = "force-dynamic";

export default async function LeaveEncashmentListPage() {
  try {
    const result = await getLeaveEncashments();
    const initialData = result.status && result.data ? result.data : [];

    return <LeaveEncashmentList initialData={initialData} />;
  } catch (error) {
    console.error("Error in LeaveEncashmentListPage:", error);
    return (
      <ListError
        title="Failed to load leave encashment records"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

