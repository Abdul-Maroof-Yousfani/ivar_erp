import { getSilhouettes } from "@/lib/actions/silhouette";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SilhouetteList } from "./silhouette-list";

interface SilhouetteListPageProps {
    searchParams: {
        new?: string;
    };
}

export default async function SilhouetteListPage({
    searchParams,
}: SilhouetteListPageProps) {
    try {
        const result = await getSilhouettes();
        const silhouettes = result.status ? result.data : [];

        return (
            <PermissionGuard permissions="master.silhouette.read">
                <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                    <div className="flex items-center justify-between space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Silhouette</h2>
                    </div>
                    <SilhouetteList
                        initialSilhouettes={silhouettes}
                        newItemId={searchParams.new}
                    />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        console.error("Error fetching silhouettes:", error);
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-destructive">Error</h2>
                <p className="text-muted-foreground">Failed to load silhouettes data.</p>
            </div>
        );
    }
}
