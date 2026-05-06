import { getBanks } from "@/lib/actions/bank";
import { BankList } from "./bank-list";

export const dynamic = "force-dynamic";

export default async function BankListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  const { newItemId } = await searchParams;
  const { data: banks } = await getBanks();

  return <BankList initialBanks={banks || []} newItemId={newItemId} />;
}

