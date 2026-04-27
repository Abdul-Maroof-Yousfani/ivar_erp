import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { getDeductionHeads } from "@/lib/actions/deduction";
import { CreateDeductionClient } from "./create-deduction-client";

export default async function CreateDeductionPage() {
  // Fetch initial data on server
  const [deptResult, empResult, headsResult] = await Promise.all([
    getDepartments(),
    getEmployeesForDropdown(),
    getDeductionHeads(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const employees = empResult.status && empResult.data ? empResult.data : [];
  const deductionHeads =
    headsResult.status && headsResult.data
      ? headsResult.data.filter((h) => h.status === "active")
      : [];

  return (
    <CreateDeductionClient
      initialDepartments={departments}
      initialEmployees={employees}
      initialDeductionHeads={deductionHeads}
    />
  );
}
