import { getChannelClasses } from "@/lib/actions/channel-class";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { ChannelClassList } from "./channel-class-list";

interface ChannelClassListPageProps {
    searchParams: {
        new?: string;
    };
}

export default async function ChannelClassListPage({
    searchParams,
}: ChannelClassListPageProps) {
    try {
        const result = await getChannelClasses();
        const items = result.status ? result.data : [];

        return (
            <PermissionGuard permissions="master.channel-class.read">
                <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                    <div className="flex items-center justify-between space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Channel Class</h2>
                    </div>
                    <ChannelClassList
                        initialItems={items}
                        newItemId={searchParams.new}
                    />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        console.error("Error fetching channel classes:", error);
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-destructive">Error</h2>
                <p className="text-muted-foreground">Failed to load channel class data.</p>
            </div>
        );
    }
}
