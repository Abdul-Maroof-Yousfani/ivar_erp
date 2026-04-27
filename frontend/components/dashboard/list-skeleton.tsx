"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ListFilter, List, Plus } from "lucide-react";

interface ListSkeletonProps {
  title?: string;
  subtitle?: string;
  actionText?: string;
  rowCount?: number;
  columnCount?: number;
}

export function ListSkeleton({
  title = "Loading...",
  subtitle = "Please wait while we load the data",
  actionText = "Add Item",
  rowCount = 5,
  columnCount = 4,
}: ListSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Search and Actions Section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Bar */}
          <div className="relative md:w-auto w-full">
            <Skeleton className="h-9 min-w-60 w-full md:w-60" />
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <List className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button size="sm" disabled>
            <Plus className="h-4 w-4 mr-2" />
            {actionText}
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {/* Checkbox Column */}
                <th className="h-12 px-4 text-left align-middle">
                  <Skeleton className="h-4 w-4" />
                </th>
                {/* Data Columns */}
                {Array.from({ length: columnCount }).map((_, i) => (
                  <th key={i} className="h-12 px-4 text-left align-middle">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
                {/* Actions Column */}
                <th className="h-12 px-4 text-right align-middle">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b transition-colors hover:bg-muted/50">
                  {/* Checkbox */}
                  <td className="p-4 align-middle">
                    <Skeleton className="h-4 w-4" />
                  </td>
                  {/* Data Cells */}
                  {Array.from({ length: columnCount }).map((_, colIndex) => {
                    // Deterministic width based on row and column index
                    const widths = [70, 85, 60, 75, 90, 65, 80];
                    const widthIndex = (rowIndex * columnCount + colIndex) % widths.length;
                    return (
                      <td key={colIndex} className="p-4 align-middle">
                        <Skeleton
                          className="h-4"
                          style={{
                            width: `${widths[widthIndex]}%`,
                          }}
                        />
                      </td>
                    );
                  })}
                  {/* Actions Cell */}
                  <td className="p-4 align-middle text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

