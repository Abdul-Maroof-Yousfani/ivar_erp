import { getTaxSlabs } from "@/lib/actions/tax-slab";
import { TaxSlabList } from "./tax-slab-list";

export const dynamic = "force-dynamic";

export default async function TaxSlabListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  const { newItemId } = await searchParams;
  const { data: taxSlabs } = await getTaxSlabs();

  return <TaxSlabList initialTaxSlabs={taxSlabs || []} newItemId={newItemId} />;
}
