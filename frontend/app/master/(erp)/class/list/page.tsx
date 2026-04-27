import { PermissionGuard } from "@/components/auth/permission-guard";
import { getItemClasses } from "@/lib/actions/item-class";
import { ClassList } from "./class-list";

export default async function ClassListPage() {
    const response = await getItemClasses();
    const classes = response.status ? response.data : [];

    return (
        <PermissionGuard permissions="master.item-class.read">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Item Classes</h1>
                    <p className="text-muted-foreground">
                        Manage your ERP item classes here.
                    </p>
                </div>
                <ClassList initialData={classes} />
            </div>
        </PermissionGuard>
    );
}
