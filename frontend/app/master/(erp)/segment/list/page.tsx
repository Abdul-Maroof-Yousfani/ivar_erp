import { PermissionGuard } from "@/components/auth/permission-guard";
import { getSegments } from "@/lib/actions/segment";
import { SegmentList } from "./segment-list";

export default async function SegmentListPage() {
    const response = await getSegments();
    const segments = response.status ? response.data : [];

    return (
        <PermissionGuard permissions="master.segment.read">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Segments</h1>
                    <p className="text-muted-foreground">
                        Manage your ERP segments here.
                    </p>
                </div>
                <SegmentList initialData={segments} />
            </div>
        </PermissionGuard>
    );
}
