import { getPromos } from "@/lib/actions/pos-config";
import { PromosListPage } from "./promos-list-page";

export default async function PromosPage() {
    const res = await getPromos();
    return <PromosListPage promos={res.data ?? []} />;
}
