import { getEmployeeStatuses } from "@/lib/actions/employee-status";
import { EmployeeStatusList } from "./employee-status-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function EmployeeStatusListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getEmployeeStatuses();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load employee statuses"
          message={result.message || "Unable to fetch employee statuses. Please check your connection and try again."}
        />
      );
    }

    return (
      <EmployeeStatusList
        initialEmployeeStatuses={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in EmployeeStatusListPage:", error);
    return (
      <ListError
        title="Failed to load employee statuses"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

