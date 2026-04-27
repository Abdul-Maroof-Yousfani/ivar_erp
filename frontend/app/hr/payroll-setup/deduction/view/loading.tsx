import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Filters Card Skeleton */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle>
                <Skeleton className="h-6 w-24" />
              </CardTitle>
              <CardDescription>
                <Skeleton className="h-4 w-80" />
              </CardDescription>
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-4">
            {/* Search Bar Skeleton */}
            <Skeleton className="h-10 w-full max-w-md" />

            {/* Table Header Skeleton */}
            <div className="space-y-3">
              <div className="flex gap-4 border-b pb-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-24" />
                ))}
              </div>

              {/* Table Rows Skeleton */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3 border-b">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-24" />
                  ))}
                </div>
              ))}
            </div>

            {/* Pagination Skeleton */}
            <div className="flex items-center justify-between pt-4">
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
