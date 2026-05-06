import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Global loading skeleton for the HR module.
 * This will be shown when navigating between server-side pages in the HR section.
 */
export default function HRLoading() {
    return (
        <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            {/* Page Header Skeleton */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-2">
                <div className="space-y-2">
                    {/* Breadcrumbs placeholder */}
                    <div className="flex gap-2 items-center">
                        <Skeleton className="h-4 w-16" />
                        <span className="text-muted-foreground/30">/</span>
                        <Skeleton className="h-4 w-24" />
                    </div>
                    {/* Page Title placeholder */}
                    <Skeleton className="h-10 w-64 md:w-80" />
                </div>
                {/* Action Button placeholder */}
                <Skeleton className="h-11 w-36 rounded-lg" />
            </div>

            {/* Statistics Cards Skeleton Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 h-14">
                            <Skeleton className="h-4 w-28" />
                            <div className="p-2 bg-muted/40 rounded-full">
                                <Skeleton className="h-4 w-4 rounded-full" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <Skeleton className="h-9 w-20 mb-2" />
                            <Skeleton className="h-3 w-40" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Dynamic Content Area (Dashboard/Table/Form) */}
            <div className="grid gap-6 md:grid-cols-12">
                {/* Left/Main Column */}
                <div className="md:col-span-8 space-y-6">
                    <Card className="border-none shadow-sm h-[420px]">
                        <CardHeader className="border-b border-border/40 py-4">
                            <Skeleton className="h-6 w-56" />
                        </CardHeader>
                        <CardContent className="flex items-center justify-center p-8">
                            {/* Visual placeholder for a chart or data viz */}
                            <div className="w-full h-full flex flex-col gap-4">
                                <div className="flex items-end gap-3 h-full pt-4">
                                    {[60, 40, 75, 50, 90, 65, 45, 80].map((height, i) => (
                                        <Skeleton key={i} className="w-full rounded-t-lg" style={{ height: `${height}%` }} />
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table placeholder */}
                    <Card className="border-none shadow-sm">
                        <CardHeader className="border-b border-border/40 py-4 flex flex-row items-center justify-between">
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-8 w-24" />
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/30">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-10 w-10 rounded-full" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-28" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-4 w-16 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right/Sidebar Column */}
                <div className="md:col-span-4 space-y-6">
                    <Card className="border-none shadow-sm h-[320px]">
                        <CardHeader className="border-b border-border/40 py-4">
                            <Skeleton className="h-6 w-40" />
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center p-8 gap-6">
                            <Skeleton className="h-40 w-40 rounded-full" />
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardHeader className="border-b border-border/40 py-4">
                            <Skeleton className="h-6 w-32" />
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-3 w-24" />
                                        <Skeleton className="h-3 w-12" />
                                    </div>
                                    <Skeleton className="h-2 w-full rounded-full" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
