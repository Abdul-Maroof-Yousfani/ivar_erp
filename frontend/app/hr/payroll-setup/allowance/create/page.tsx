import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { getAllowanceHeads } from "@/lib/actions/allowance";
import { CreateAllowanceClient } from "./create-allowance-client";

export default async function CreateAllowancePage() {
  // Fetch initial data on server
  const [deptResult, empResult, headsResult] = await Promise.all([
    getDepartments(),
    getEmployeesForDropdown(),
    getAllowanceHeads(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const employees = empResult.status && empResult.data ? empResult.data : [];
  const allowanceHeads =
    headsResult.status && headsResult.data
      ? headsResult.data.filter((h) => h.status === "active")
      : [];

  return (
    <CreateAllowanceClient
      initialDepartments={departments}
      initialEmployees={employees}
      initialAllowanceHeads={allowanceHeads}
    />
  );
}
