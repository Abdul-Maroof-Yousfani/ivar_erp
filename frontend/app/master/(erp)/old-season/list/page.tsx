import { PermissionGuard } from "@/components/auth/permission-guard";
import { getOldSeasons } from "@/lib/actions/old-season";
import { OldSeasonList } from "./old-season-list";

export default async function OldSeasonListPage() {
  const response = await getOldSeasons();
  const seasons = response.status ? response.data : [];

  return (
    <PermissionGuard permissions="master.old-season.read">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Old Seasons</h1>
          <p className="text-muted-foreground">
            Manage your ERP old seasons here.
          </p>
        </div>
        <OldSeasonList initialData={seasons} />
      </div>
    </PermissionGuard>
  );
}
