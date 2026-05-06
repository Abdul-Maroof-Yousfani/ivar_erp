import { HrLetterList } from "./hr-letter-list";
import { ListError } from "@/components/dashboard/list-error";
import type { HrLetterRow } from "./columns";

export const dynamic = "force-dynamic";

export default async function ViewHrLetterPage() {
  try {
    // TODO: Replace with actual API call to fetch HR letters
    // const result = await getHrLetters();
    // For now, using dummy data
    const initialData: HrLetterRow[] = [];

    return <HrLetterList initialData={initialData} />;
  } catch (error) {
    console.error("Error in ViewHrLetterPage:", error);
    return (
      <ListError
        title="Failed to load HR letters"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

