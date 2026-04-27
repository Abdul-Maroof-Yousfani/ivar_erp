import { getAllocations } from "@/lib/actions/allocation";
import { AllocationList } from "./allocation-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function AllocationListPage({
    searchParams,
}: {
    searchParams: Promise<{ newItemId?: string }>;
}) {
    try {
        const { newItemId } = await searchParams;
        const result = await getAllocations();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load allocations"
                    message={result.message || "Unable to fetch allocations. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions="allocation.read" >
                <AllocationList
                    initialAllocations={result.data || []}
                    newItemId={newItemId}
                />
            </PermissionGuard>
        );
    } catch (error) {
        console.error("Error in AllocationListPage:", error);
        return (
            <ListError
                title="Failed to load allocations"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
