import { getBonusTypes } from "@/lib/actions/bonus-type";
import { BonusTypeList } from "./bonus-type-list";

export const dynamic = "force-dynamic";

export default async function BonusTypeListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  const { newItemId } = await searchParams;
  const { data: bonusTypes } = await getBonusTypes();

  return <BonusTypeList initialBonusTypes={bonusTypes || []} newItemId={newItemId} />;
}

