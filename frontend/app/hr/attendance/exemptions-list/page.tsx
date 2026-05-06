import { getEmployees } from "@/lib/actions/employee";
import { getAttendanceExemptions } from "@/lib/actions/attendance-exemption";
import { getDepartments } from "@/lib/actions/department";
import { AttendanceExemptionsList } from "./attendance-exemptions-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function AttendanceExemptionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const employeesResult = await getEmployees();

    if (!employeesResult.status || !employeesResult.data) {
      return (
        <ListError
          title="Failed to load employees"
          message={employeesResult.message || "Unable to fetch employees. Please check your connection and try again."}
        />
      );
    }

    const employees = employeesResult.data || [];
    
    const exemptionsResult = await getAttendanceExemptions();
    const exemptions = exemptionsResult.status && exemptionsResult.data ? exemptionsResult.data : [];

    const departmentsResult = await getDepartments();
    const departments = departmentsResult.status && departmentsResult.data ? departmentsResult.data : [];

    return (
      <AttendanceExemptionsList
        initialExemptions={exemptions}
        employees={employees}
        departments={departments}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in AttendanceExemptionsListPage:", error);
    return (
      <ListError
        title="Failed to load attendance exemptions"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

