import { getBrands } from "@/lib/actions/brand";
import { BrandList } from "./brand-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function BrandListPage({
    searchParams,
}: {
    searchParams: Promise<{ newItemId?: string }>;
}) {

    try {
        const { newItemId } = await searchParams;
        const result = await getBrands();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load brands"
                    message={result.message || "Unable to fetch brands. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions={["master.brand.read"]}>
                <BrandList
                    initialBrands={result.data || []}
                    newItemId={newItemId}
                />
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <ListError
                title="Failed to load brands"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
