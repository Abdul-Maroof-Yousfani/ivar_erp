import { getDivisions } from "@/lib/actions/division";
import { DivisionList } from "./division-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function DivisionListPage({
    searchParams,
}: {
    searchParams: Promise<{ newItemId?: string }>;
}) {

    try {
        const { newItemId } = await searchParams;
        const result = await getDivisions();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load divisions"
                    message={result.message || "Unable to fetch divisions. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions={["master.division.read"]}>
                <DivisionList
                    initialDivisions={result.data || []}
                    newItemId={newItemId}
                />
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <ListError
                title="Failed to load divisions"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
