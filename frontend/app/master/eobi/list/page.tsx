import { getEOBIs } from "@/lib/actions/eobi";
import { EOBIList } from "./eobi-list";

export const dynamic = "force-dynamic";

export default async function EOBIListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  const { newItemId } = await searchParams;
  const { data: eobis } = await getEOBIs();

  return <EOBIList initialEOBIs={eobis || []} newItemId={newItemId} />;
}
