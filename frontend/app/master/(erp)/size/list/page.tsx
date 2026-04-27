import { getSizes } from "@/lib/actions/size";
import { SizeList } from "./size-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function SizeListPage({
    searchParams,
}: {
    searchParams: Promise<{ newItemId?: string }>;
}) {

    try {
        const { newItemId } = await searchParams;
        const result = await getSizes();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load sizes"
                    message={result.message || "Unable to fetch sizes. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions={["master.size.read"]}>
                <SizeList
                    initialSizes={result.data || []}
                    newItemId={newItemId}
                />
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <ListError
                title="Failed to load sizes"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
