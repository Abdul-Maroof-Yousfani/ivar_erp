import { getDepartments } from "@/lib/actions/department";
import { getAllowanceHeads } from "@/lib/actions/allowance";
import { CreateAllowanceClient } from "./create-allowance-client";

export default async function CreateAllowancePage() {
  // Fetch initial data on server
  const [deptResult, headsResult] = await Promise.all([
    getDepartments(),
    getAllowanceHeads(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const allowanceHeads =
    headsResult.status && headsResult.data
      ? headsResult.data.filter((h) => h.status === "active")
      : [];

  return (
    <CreateAllowanceClient
      initialDepartments={departments}
      initialAllowanceHeads={allowanceHeads}
    />
  );
}
