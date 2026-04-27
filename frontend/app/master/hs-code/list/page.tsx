import { getHsCodes } from "@/lib/actions/hs-code";
import { HsCodeList } from "./hs-code-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function HsCodeListPage({
    searchParams,
}: {
    searchParams: Promise<{ newItemId?: string }>;
}) {
    try {
        const { newItemId } = await searchParams;
        const result = await getHsCodes();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load HS codes"
                    message={result.message || "Unable to fetch HS codes. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions="master.hs-code.read">
                <HsCodeList
                    initialHsCodes={result.data || []}
                    newItemId={newItemId}
                />
            </PermissionGuard>
        );
    } catch (error) {
        console.error("Error in HsCodeListPage:", error);
        return (
            <ListError
                title="Failed to load HS codes"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
