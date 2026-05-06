import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { CreateOvertimeClient } from "./create-overtime-client";

export default async function CreateOvertimePage() {
  // Fetch initial data on server
  const [empResult, deptResult] = await Promise.all([
    getEmployeesForDropdown(),
    getDepartments(),
  ]);

  const employees = empResult.status && empResult.data ? empResult.data : [];
  const departments = deptResult.status && deptResult.data ? deptResult.data : [];

  return (
    <CreateOvertimeClient
      initialEmployees={employees}
      initialDepartments={departments}
    />
  );
}

