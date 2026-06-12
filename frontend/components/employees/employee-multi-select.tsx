"use client";

import { MultiSelect } from "@/components/ui/multi-select";
import { useEmployeeDropdown } from "@/hooks/use-employee-dropdown";

export interface EmployeeMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  departmentId?: string;
  subDepartmentId?: string;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxDisplayedItems?: number;
  className?: string;
}

export function EmployeeMultiSelect({
  value,
  onValueChange,
  departmentId,
  subDepartmentId,
  disabled = false,
  placeholder = "Select employees...",
  searchPlaceholder = "Search by name or employee ID...",
  emptyMessage,
  maxDisplayedItems = 3,
  className,
}: EmployeeMultiSelectProps) {
  const { isInitialLoading, loading, multiSelectProps } = useEmployeeDropdown({
    departmentId,
    subDepartmentId,
    selectedIds: value,
  });

  if (isInitialLoading) {
    return <div className="h-10 bg-muted rounded-md animate-pulse" />;
  }

  return (
    <MultiSelect
      options={multiSelectProps.options}
      value={value}
      onValueChange={onValueChange}
      onSearch={multiSelectProps.onSearch}
      onLoadMore={multiSelectProps.onLoadMore}
      hasMore={multiSelectProps.hasMore}
      isLoading={multiSelectProps.isLoading}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage ?? (loading ? "Loading employees..." : "No employees found")}
      disabled={disabled}
      maxDisplayedItems={maxDisplayedItems}
      className={className}
      showSelectAll={false}
    />
  );
}
