import { getDepartments } from "@/lib/actions/department";
import { getEmployeeGrades } from "@/lib/actions/employee-grade";
import { getDesignations } from "@/lib/actions/designation";
import { CreateIncrementClient } from "./create-increment-client";

export default async function CreateIncrementPage() {
  const [deptResult, gradesResult, designationsResult] = await Promise.all([
    getDepartments(),
    getEmployeeGrades(),
    getDesignations(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
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
      initialEmployeeGrades={employeeGrades}
      initialDesignations={designations}
    />
  );
}

