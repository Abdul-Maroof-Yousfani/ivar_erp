import { PermissionGuard } from "@/components/auth/permission-guard";
import { getSeasons } from "@/lib/actions/season";
import { SeasonList } from "./season-list";

export default async function SeasonListPage() {
    const response = await getSeasons();
    const seasons = response.status ? response.data : [];

    return (
        <PermissionGuard permissions="master.season.read">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Seasons</h1>
                    <p className="text-muted-foreground">
                        Manage your ERP seasons here.
                    </p>
                </div>
                <SeasonList initialData={seasons} />
            </div>
        </PermissionGuard>
    );
}
