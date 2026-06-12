"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import {
  getEmployeesForDropdown,
  type EmployeeDropdownOption,
} from "@/lib/actions/employee";
import type { MultiSelectOption } from "@/components/ui/multi-select";

function normalizeFilterId(value?: string) {
  if (!value || value === "all") return undefined;
  return value;
}

export interface UseEmployeeDropdownOptions {
  departmentId?: string;
  subDepartmentId?: string;
  selectedIds?: string[];
  limit?: number;
  providentFundOnly?: boolean;
}

export function useEmployeeDropdown({
  departmentId,
  subDepartmentId,
  selectedIds = [],
  limit = 100,
  providentFundOnly = false,
}: UseEmployeeDropdownOptions = {}) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [searchResults, setSearchResults] = useState<EmployeeDropdownOption[]>([]);
  const [knownEmployees, setKnownEmployees] = useState<Map<string, EmployeeDropdownOption>>(new Map());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const filterKeyRef = useRef("");

  const normalizedDepartmentId = normalizeFilterId(departmentId);
  const normalizedSubDepartmentId = normalizeFilterId(subDepartmentId);

  useEffect(() => {
    setPage(1);
    setSearchResults([]);
    setSearchInput("");
  }, [normalizedDepartmentId, normalizedSubDepartmentId, providentFundOnly]);

  useEffect(() => {
    const filterKey = `${normalizedDepartmentId}|${normalizedSubDepartmentId}|${debouncedSearch}|${providentFundOnly}`;
    const filtersChanged = filterKey !== filterKeyRef.current;
    filterKeyRef.current = filterKey;

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }

    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const fetchPage = filtersChanged ? 1 : page;
        const result = await getEmployeesForDropdown({
          departmentId: normalizedDepartmentId,
          subDepartmentId: normalizedSubDepartmentId,
          search: debouncedSearch || undefined,
          page: fetchPage,
          limit,
          providentFund: providentFundOnly || undefined,
        });

        if (result.status && result.data) {
          if (fetchPage === 1) {
            setSearchResults(result.data);
          } else {
            setSearchResults((prev) => [...prev, ...result.data!]);
          }

          setHasMore(result.meta ? result.meta.page < result.meta.totalPages : false);
          setTotalCount(result.meta?.total ?? result.data.length);

          setKnownEmployees((prev) => {
            const next = new Map(prev);
            result.data!.forEach((emp) => next.set(emp.id, emp));
            return next;
          });
        } else {
          if (fetchPage === 1) {
            setSearchResults([]);
            setTotalCount(0);
          }
          if (result.message) toast.error(result.message);
        }
      } catch (error) {
        console.error("Error fetching employees:", error);
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [normalizedDepartmentId, normalizedSubDepartmentId, debouncedSearch, page, limit, providentFundOnly]);

  const displayEmployees = useMemo(() => {
    const map = new Map<string, EmployeeDropdownOption>();

    selectedIds.forEach((id) => {
      const emp = knownEmployees.get(id);
      if (emp) map.set(id, emp);
    });

    searchResults.forEach((emp) => {
      map.set(emp.id, emp);
    });

    return Array.from(map.values());
  }, [searchResults, selectedIds, knownEmployees]);

  const options: MultiSelectOption[] = useMemo(
    () =>
      displayEmployees.map((emp) => ({
        value: emp.id,
        label: emp.employeeName,
        description: `${emp.employeeId}${emp.departmentName ? ` • ${emp.departmentName}` : ""}`,
      })),
    [displayEmployees]
  );

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const getEmployee = (id: string) => knownEmployees.get(id);

  const isInitialLoading = loading && page === 1 && searchResults.length === 0;

  return {
    options,
    employees: displayEmployees,
    totalCount,
    loading,
    isInitialLoading,
    hasMore,
    getEmployee,
    knownEmployees,
    multiSelectProps: {
      options,
      onSearch: setSearchInput,
      onLoadMore: handleLoadMore,
      hasMore,
      isLoading: loading,
    },
  };
}
