import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="max-w-[90%] mx-auto pb-10">
      {/* Header Skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="border rounded-xl p-4 space-y-6">
        {/* Profile Header Skeleton */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <div className="flex flex-col items-center text-center gap-4">
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48 mx-auto" />
                <Skeleton className="h-5 w-32 mx-auto" />
                <Skeleton className="h-6 w-20 mx-auto" />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Basic Information Skeleton */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Basic Information</CardTitle>
            <CardDescription>Employee personal & job-related details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 24 }).map((_, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-muted/10"
                >
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Qualification Section Skeleton */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Qualification</CardTitle>
            <CardDescription>Employee educational qualifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg bg-muted/10"
                  >
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Information Skeleton */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-muted/10"
              >
                <Skeleton className="h-3 w-32 mb-2" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Bank Account Details Skeleton */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Bank Account Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-muted/10"
              >
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Equipment Issued Skeleton */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Equipment Issued</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-muted/10"
              >
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Login Credentials Skeleton */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Login Credentials</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

