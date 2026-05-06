import { getGenders } from "@/lib/actions/gender";
import { GenderList } from "./gender-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function GenderListPage({
    searchParams,
}: {
    searchParams: Promise<{ newItemId?: string }>;
}) {

    try {
        const { newItemId } = await searchParams;
        const result = await getGenders();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load genders"
                    message={result.message || "Unable to fetch genders. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions={["master.gender.read"]}>
                <GenderList
                    initialGenders={result.data || []}
                    newItemId={newItemId}
                />
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <ListError
                title="Failed to load genders"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
