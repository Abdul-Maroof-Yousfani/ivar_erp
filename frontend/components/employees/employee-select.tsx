"use client";

import { useCallback } from "react";
import { InfiniteAutocomplete } from "@/components/ui/infinite-autocomplete";
import {
  getEmployeesForDropdown,
  type EmployeeDropdownOption,
} from "@/lib/actions/employee";

function normalizeFilterId(value?: string) {
  if (!value || value === "all") return undefined;
  return value;
}

export interface EmployeeSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  departmentId?: string;
  subDepartmentId?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  selectedLabel?: string;
  providentFundOnly?: boolean;
}

export function EmployeeSelect({
  value,
  onValueChange,
  departmentId,
  subDepartmentId,
  includeAllOption = false,
  allOptionLabel = "All Employees",
  disabled = false,
  placeholder = "Select employee...",
  searchPlaceholder = "Search by name or employee ID...",
  emptyMessage = "No employees found",
  className,
  selectedLabel,
  providentFundOnly = false,
}: EmployeeSelectProps) {
  const normalizedDepartmentId = normalizeFilterId(departmentId);
  const normalizedSubDepartmentId = normalizeFilterId(subDepartmentId);

  const fetchData = useCallback(
    async ({ page, limit, search }: { page: number; limit: number; search: string }) => {
      const result = await getEmployeesForDropdown({
        page,
        limit,
        search: search || undefined,
        departmentId: normalizedDepartmentId,
        subDepartmentId: normalizedSubDepartmentId,
        providentFund: providentFundOnly || undefined,
      });

      if (!result.status || !result.data) {
        return result;
      }

      const options = includeAllOption && page === 1 && !search
        ? [{ id: "all", employeeId: "", employeeName: allOptionLabel } as EmployeeDropdownOption, ...result.data]
        : result.data;

      return {
        ...result,
        data: options,
      };
    },
    [normalizedDepartmentId, normalizedSubDepartmentId, includeAllOption, allOptionLabel, providentFundOnly]
  );

  const mapOption = useCallback(
    (item: EmployeeDropdownOption) => ({
      value: item.id,
      label: item.id === "all" ? allOptionLabel : `(${item.employeeId}) ${item.employeeName}`,
      description: item.departmentName ?? undefined,
    }),
    [allOptionLabel]
  );

  return (
    <InfiniteAutocomplete
      fetchData={fetchData}
      mapOption={mapOption}
      value={value === "all" ? "all" : value}
      onValueChange={(nextValue) => onValueChange(nextValue || (includeAllOption ? "all" : ""))}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
      className={className}
      selectedLabel={selectedLabel}
    />
  );
}
