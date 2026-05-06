import { PermissionGuard } from "@/components/auth/permission-guard";
import { getItemSubclasses } from "@/lib/actions/item-subclass";
import { getItemClasses } from "@/lib/actions/item-class";
import { SubclassList } from "./subclass-list";

export default async function SubclassListPage() {
    const [subclassesRes, classesRes] = await Promise.all([
        getItemSubclasses(),
        getItemClasses()
    ]);

    const subclasses = subclassesRes.status ? subclassesRes.data : [];
    const classes = classesRes.status ? classesRes.data : [];

    return (
        <PermissionGuard permissions="master.item-subclass.read">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Item Subclasses</h1>
                    <p className="text-muted-foreground">
                        Manage your ERP item subclasses and their mappings to item classes.
                    </p>
                </div>
                <SubclassList initialData={subclasses} classes={classes} />
            </div>
        </PermissionGuard>
    );
}
