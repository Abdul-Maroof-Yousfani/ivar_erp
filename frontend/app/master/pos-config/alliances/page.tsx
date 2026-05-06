import { getAlliances } from "@/lib/actions/pos-config";
import { AlliancesListPage } from "./alliances-list-page";

export default async function AlliancesPage() {
    const res = await getAlliances();
    return <AlliancesListPage alliances={res.data ?? []} />;
}
