import { getPosByLocation } from "@/lib/actions/pos";
import { getLocationById } from "@/lib/actions/location";
import { PosList } from "./pos-list";
import { ListError } from "@/components/dashboard/list-error";
import { getCompanies } from "@/lib/actions/companies";

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ newItemId?: string }>;
}

export const dynamic = "force-dynamic";

export default async function LocationPosPage({ params, searchParams }: PageProps) {
    try {
        const { id } = await params;
        const { newItemId } = await searchParams;

        const [posRes, locationRes, companiesRes] = await Promise.all([
            getPosByLocation(id),
            getLocationById(id),
            getCompanies(),
        ]);

        if (!locationRes.status || !locationRes.data) {
            return (
                <ListError
                    title="Location not found"
                    message="The specified location could not be found."
                />
            );
        }

        if (!posRes.status) {
            return (
                <ListError
                    title="Failed to load POS terminals"
                    message={posRes.message || "Unable to fetch POS terminals."}
                />
            );
        }

        const posTerminals = posRes.data || [];
        const location = locationRes.data;
        const companies = companiesRes.status ? (companiesRes.data || []) : [];

        return (
            <div className="p-0">
                <PosList
                    initialPos={posTerminals}
                    location={location}
                    companies={companies}
                    newItemId={newItemId}
                />
            </div>
        );
    } catch (error) {
        return (
            <ListError
                title="Unexpected Error"
                message="An unexpected error occurred while loading the POS list."
            />
        );
    }
}
