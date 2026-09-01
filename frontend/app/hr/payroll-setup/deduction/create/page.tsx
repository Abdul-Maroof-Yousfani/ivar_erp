import { getDepartments } from "@/lib/actions/department";
import { getDeductionHeads } from "@/lib/actions/deduction";
import { CreateDeductionClient } from "./create-deduction-client";

export default async function CreateDeductionPage() {
  const [deptResult, headsResult] = await Promise.all([
    getDepartments(),
    getDeductionHeads(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const deductionHeads =
    headsResult.status && headsResult.data
      ? headsResult.data.filter((h) => h.status === "active")
      : [];

  return (
    <CreateDeductionClient
      initialDepartments={departments}
      initialDeductionHeads={deductionHeads}
    />
  );
}
