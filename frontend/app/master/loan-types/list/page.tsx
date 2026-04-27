import { getLoanTypes } from "@/lib/actions/loan-type";
import { LoanTypeList } from "./loan-type-list";

export const dynamic = "force-dynamic";

export default async function LoanTypeListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  const { newItemId } = await searchParams;
  const { data: loanTypes } = await getLoanTypes();

  return <LoanTypeList initialLoanTypes={loanTypes || []} newItemId={newItemId} />;
}
