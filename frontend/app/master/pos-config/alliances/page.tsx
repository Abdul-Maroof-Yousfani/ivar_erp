import { getAlliances } from "@/lib/actions/pos-config";
import { getLocations } from "@/lib/actions/location";
import { AlliancesListPage } from "./alliances-list-page";

export default async function AlliancesPage() {
    const [alliancesRes, locationsRes] = await Promise.all([
        getAlliances(),
        getLocations(),
    ]);
    return <AlliancesListPage alliances={alliancesRes.data ?? []} locations={locationsRes.data ?? []} />;
}
