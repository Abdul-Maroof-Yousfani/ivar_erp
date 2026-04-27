import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { getEmployeeGrades } from "@/lib/actions/employee-grade";
import { getDesignations } from "@/lib/actions/designation";
import { CreateIncrementClient } from "./create-increment-client";

export default async function CreateIncrementPage() {
  // Fetch initial data on server
  const [deptResult, empResult, gradesResult, designationsResult] = await Promise.all([
    getDepartments(),
    getEmployeesForDropdown(),
    getEmployeeGrades(),
    getDesignations(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const employees = empResult.status && empResult.data ? empResult.data : [];
  const employeeGrades =
    gradesResult.status && gradesResult.data
      ? gradesResult.data.filter((g) => g.status === "active")
      : [];
  const designations =
    designationsResult.status && designationsResult.data
      ? designationsResult.data.filter((d) => d.status === "active")
      : [];

  return (
    <CreateIncrementClient
      initialDepartments={departments}
      initialEmployees={employees}
      initialEmployeeGrades={employeeGrades}
      initialDesignations={designations}
    />
  );
}

