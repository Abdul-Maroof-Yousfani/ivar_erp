import { getItems } from "@/lib/actions/items";
import { ItemList } from "./item-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function ItemListPage() {
    try {
        const result = await getItems();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load items"
                    message={result.message || "Unable to fetch items. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions={["erp.item.read"]}>
                <div className="container mx-auto py-10">
                    <ItemList
                        initialItems={result.data || []}
                        initialMeta={result.meta}
                    />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <ListError
                title="Failed to load items"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
