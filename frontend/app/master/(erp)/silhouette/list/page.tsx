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
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Seasons</h1>
            <p className="text-muted-foreground">
              Manage your Silhouettes here.
            </p>
          </div>
          {/* <div className="flex gap-2 items-center"> */}
            <SilhouetteList
              initialSilhouettes={silhouettes}
              newItemId={searchParams.new}
            />
          </div>
        {/* </div> */}
      </PermissionGuard>
    );
  } catch (error) {
    console.error("Error fetching silhouettes:", error);
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-destructive">Error</h2>
        <p className="text-muted-foreground">
          Failed to load silhouettes data.
        </p>
      </div>
    );
  }
}
