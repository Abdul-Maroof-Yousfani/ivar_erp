import { getLeavesPolicies } from "@/lib/actions/leaves-policy";
import { LeavesPolicyList } from "./leaves-policy-list";

export const dynamic = "force-dynamic";

export default async function LeavesPolicyListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  const { newItemId } = await searchParams;
  const { data: policies } = await getLeavesPolicies();

  return <LeavesPolicyList initialPolicies={policies || []} newItemId={newItemId} />;
}
