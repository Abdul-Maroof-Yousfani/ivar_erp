import { getCountries } from "@/lib/actions/city";
import { CityAddForm } from "./city-add-form";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function AddCityPage({
  searchParams,
}: {
  searchParams: Promise<{ countryId?: string }>;
}) {
  try {
    const { countryId } = await searchParams;
    const countriesRes = await getCountries();
    
    if (!countriesRes.status || !countriesRes.data) {
      return (
        <ListError
          title="Failed to load countries"
          message={countriesRes.message || "Unable to fetch countries. Please check your connection and try again."}
        />
      );
    }

    return <CityAddForm countries={countriesRes.data} defaultCountryId={countryId} />;
  } catch (error) {
    console.error("Error in AddCityPage:", error);
    return (
      <ListError
        title="Failed to load countries"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

