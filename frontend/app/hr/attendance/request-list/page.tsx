import { getAllAttendanceRequestQueries } from "@/lib/actions/attendance-request-query";
import { getAllEmployeesForClearance } from "@/lib/actions/exit-clearance";
import { getDepartments } from "@/lib/actions/department";
import { AttendanceRequestQueryList } from "./attendance-request-query-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function AttendanceRequestQueryListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const [queriesResult, employeesResult, departmentsResult] = await Promise.all([
      getAllAttendanceRequestQueries(),
      getAllEmployeesForClearance().catch(err => ({ status: false, message: err.message, data: [] })),
      getDepartments().catch(err => ({ status: false, message: err.message, data: [] })),
    ]);

    if (!queriesResult.status || !queriesResult.data) {
      return (
        <ListError
          title="Failed to load attendance request queries"
          message={queriesResult.message || "Unable to fetch attendance request queries. Please check your connection and try again."}
        />
      );
    }

    const employees = employeesResult.status ? employeesResult.data || [] : [];
    const departments = departmentsResult.status ? departmentsResult.data || [] : [];

    return (
      <AttendanceRequestQueryList
        initialQueries={queriesResult.data || []}
        employees={employees}
        departments={departments}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in AttendanceRequestQueryListPage:", error);
    return (
      <ListError
        title="Failed to load attendance request queries"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

