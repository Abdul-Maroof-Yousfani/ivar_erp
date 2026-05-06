import { getCities, getCountries } from "@/lib/actions/city";
import { CityList } from "./city-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function CityListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const [citiesRes, countriesRes] = await Promise.all([getCities(), getCountries()]);

    if (!citiesRes.status || !citiesRes.data) {
      return (
        <ListError
          title="Failed to load cities"
          message="Unable to fetch cities. Please check your connection and try again."
        />
      );
    }

    if (!countriesRes.status || !countriesRes.data) {
      return (
        <ListError
          title="Failed to load countries"
          message="Unable to fetch countries. Please check your connection and try again."
        />
      );
    }

    return (
      <CityList
        initialCities={citiesRes.data || []}
        countries={countriesRes.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in CityListPage:", error);
    return (
      <ListError
        title="Failed to load cities"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

