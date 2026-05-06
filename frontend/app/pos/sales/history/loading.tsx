import { Skeleton } from "@/components/ui/skeleton";

export default function SalesHistoryLoading() {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 px-10">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-9 w-56" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-28" />
                </div>
            </div>

            {/* Table skeleton */}
            <div className="flex-1 p-6 px-10 overflow-hidden">
                <div className="rounded-xl border bg-card overflow-hidden">
                    {/* Table header */}
                    <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
                        {[120, 140, 60, 80, 80, 100].map((w, i) => (
                            <Skeleton key={i} className="h-4" style={{ width: w }} />
                        ))}
                    </div>
                    {/* Table rows */}
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
                            style={{ opacity: 1 - i * 0.06 }}
                        >
                            <Skeleton className="h-4 w-28 font-mono" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <div className="ml-auto flex gap-1">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
