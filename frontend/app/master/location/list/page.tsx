import { getLocations } from "@/lib/actions/location";
import { LocationList } from "./location-list";
import { ListError } from "@/components/dashboard/list-error";

interface PageProps {
  searchParams: Promise<{ newItemId?: string }>;
}

export const dynamic = "force-dynamic";

export default async function LocationListPage({ searchParams }: PageProps) {
  try {
    const params = await searchParams;
    const locationsRes = await getLocations();

    // Check if requests failed
    if (!locationsRes.status) {
      return (
        <ListError
          title="Failed to load locations"
          message={locationsRes.message || "Unable to fetch locations. Please check your connection and try again."}
        />
      );
    }

    const locations = locationsRes.data || [];

    return (
      <div className="p-0">
        <LocationList initialLocations={locations} newItemId={params.newItemId} />
      </div>
    );
  } catch (error) {
    return (
      <ListError
        title="Unexpected Error"
        message="An unexpected error occurred while loading the location list."
      />
    );
  }
}
