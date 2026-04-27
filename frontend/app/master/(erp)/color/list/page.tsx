import { getColors } from "@/lib/actions/color";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { ColorList } from "./color-list";

interface ColorListPageProps {
    searchParams: {
        new?: string;
    };
}

export default async function ColorListPage({
    searchParams,
}: ColorListPageProps) {
    try {
        const result = await getColors();
        const items = result.status ? result.data : [];

        return (
            <PermissionGuard permissions="master.color.read">
                <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                    <div className="flex items-center justify-between space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Color</h2>
                    </div>
                    <ColorList
                        initialItems={items}
                        newItemId={searchParams.new}
                    />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        console.error("Error fetching colors:", error);
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-destructive">Error</h2>
                <p className="text-muted-foreground">Failed to load color data.</p>
            </div>
        );
    }
}
