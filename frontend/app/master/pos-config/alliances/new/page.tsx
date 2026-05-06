import { getAllianceById } from "@/lib/actions/pos-config";
import { getLocations } from "@/lib/actions/location";
import { AllianceFormPage } from "./alliance-form-page";

export default async function AllianceNewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
    const sp = await searchParams;
    const [locationsRes, allianceRes] = await Promise.all([
        getLocations(),
        sp.id ? getAllianceById(sp.id) : Promise.resolve({ status: true, data: undefined }),
    ]);

    return (
        <AllianceFormPage
            locations={locationsRes.data ?? []}
            alliance={allianceRes.data}
        />
    );
}
