"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";

// Context for search highlighting
const SearchHighlightContext = createContext<string>("");
export const useSearchHighlight = () => useContext(SearchHighlightContext);

// Utility to highlight matching text
export function HighlightText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const search = useSearchHighlight();
  if (!search || !text) return <span className={className}>{text}</span>;

  const regex = new RegExp(
    `(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

import {
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleXIcon,
  Columns3Icon,
  ListFilterIcon,
  Loader2,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "../ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { motion } from "motion/react";
import { useAuth } from "@/components/providers/auth-provider";

interface DataTableRow {
  id: string;
}

export type FilterOption = {
  label: string;
  value: string;
};

export type FilterConfig = {
  key: string;
  label: string;
  options: FilterOption[];
};

type DataTableProps<TData extends DataTableRow> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  sortingColumns?: SortingState;
  toggleAction?: () => void;
  actionText?: string;
  title?: string;
  newItemId?: string;
  onMultiDelete?: (ids: string[]) => void;
  onBulkEdit?: (items: TData[]) => void;
  onRowEdit?: (item: TData) => void;
  onRowDelete?: (item: TData) => void;
  searchFields?: { key: string; label: string }[];
  filters?: FilterConfig[];
  onFilterChange?: (key: string, value: string) => void;
  resetFilterKey?: string;
  tableId?: string;
  canBulkEdit?: boolean;
  canBulkDelete?: boolean;
  canRowEdit?: boolean;
  canRowDelete?: boolean;
  /** Enable server-side pagination. When true, pass rowCount/pageCount and handle onPaginationChange */
  manualPagination?: boolean;
  /** Total number of rows (for server-side pagination) */
  rowCount?: number;
  /** Total number of pages (for server-side pagination) */
  pageCount?: number;
  /** Called when page or pageSize changes (for server-side pagination) */
  onPaginationChange?: (pagination: PaginationState) => void;
  /** Enable server-side sorting. When true, client-side sort is disabled */
  manualSorting?: boolean;
  /** Called when sort column/direction changes (for server-side sorting) */
  onSortingChange?: (sorting: SortingState) => void;
  /** Enable server-side filtering. When true, client-side filter is disabled */
  manualFiltering?: boolean;
  /** Called when search text changes (for server-side searching) */
  onSearchChange?: (search: string) => void;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Optional function to add custom class names per row */
  rowClassName?: (row: TData) => string;
};

export default function DataTable<TData extends DataTableRow>({
  columns,
  data: initialData,
  sortingColumns = [],
  toggleAction,
  actionText = "Add",
  title,
  newItemId,
  onMultiDelete,
  onBulkEdit,
  onRowEdit,
  onRowDelete,
  searchFields,
  filters,
  onFilterChange,
  resetFilterKey,
  tableId,
  canBulkEdit = true,
  canBulkDelete = true,
  canRowEdit = true,
  canRowDelete = true,
  manualPagination = false,
  rowCount,
  pageCount,
  onPaginationChange,
  manualSorting = false,
  onSortingChange: onSortingChangeProp,
  manualFiltering = false,
  onSearchChange,
  isLoading = false,
  rowClassName,
}: DataTableProps<TData>) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<TData[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>(sortingColumns);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Debounced search callback for server-side mode
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get preferences from AuthProvider
  const { getPreference, updatePreference } = useAuth();

  // Storage key for column visibility
  const storageKey = tableId ? `table-column-visibility-${tableId}` : null;
  const isInitialMount = useRef(true);

  // Initialize column visibility from AuthProvider preferences
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!storageKey) return {};
    const saved = getPreference(storageKey);
    return saved || {};
  });
  const [highlightedId, setHighlightedId] = useState<string | null>(
    newItemId || null
  );

  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const isMobile = useIsMobile();

  // Horizontal scroll indicator
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const updateScrollIndicators = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollIndicators();
    el.addEventListener("scroll", updateScrollIndicators);
    const ro = new ResizeObserver(updateScrollIndicators);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollIndicators);
      ro.disconnect();
    };
  }, [data]);

  // Combine search and filters into a single global filter value to trigger re-filtering
  const globalFilterValue = JSON.stringify({ search, activeFilters });

  const tableColumns = React.useMemo(() => {
    if (!onRowEdit && !onRowDelete) return columns;

    return [
      ...columns,
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }: { row: any }) => (
          <div className="flex items-center gap-2">
            {onRowEdit && canRowEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRowEdit(row.original)}
                title="Edit"
              >
                <PencilIcon size={16} />
              </Button>
            )}
            {onRowDelete && canRowDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => onRowDelete(row.original)}
                title="Delete"
              >
                <TrashIcon size={16} />
              </Button>
            )}
          </div>
        ),
      },
    ];
  }, [columns, onRowEdit, onRowDelete, canRowEdit, canRowDelete]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      onSortingChangeProp?.(next);
    },
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;
      setPagination(next);
      onPaginationChange?.(next);
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination,
    manualSorting,
    manualFiltering,
    rowCount,
    pageCount,
    globalFilterFn: (row) => {
      // Check search filter (OR across searchFields)
      if (search && searchFields?.length) {
        const searchLower = search.toLowerCase();
        const matchesSearch = searchFields.some((field) => {
          const value = row.getValue(field.key);
          return String(value ?? "")
            .toLowerCase()
            .includes(searchLower);
        });
        if (!matchesSearch) return false;
      }

      // Check active filters (AND across all filters)
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value && value !== "all") {
          let rowValue: any;
          try {
            rowValue = row.getValue(key);
          } catch {
            const originalData = row.original as any;
            rowValue = originalData?.[key];
          }

          if (rowValue === undefined || rowValue === null) {
            const originalData = row.original as any;
            rowValue = originalData?.[key];
          }

          const rowValueStr = rowValue != null ? String(rowValue).trim() : "";
          const filterValueStr = String(value).trim();

          if (!rowValueStr && !filterValueStr) continue;

          const isIdField =
            key === "employeeId" || key === "id" || key.includes("Id");
          if (isIdField) {
            if (rowValueStr !== filterValueStr) return false;
          } else {
            if (rowValueStr.toLowerCase() !== filterValueStr.toLowerCase())
              return false;
          }
        }
      }

      return true;
    },
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
      globalFilter: globalFilterValue,
    },
  });

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Load column visibility from AuthProvider preferences on mount
  useEffect(() => {
    if (!storageKey) return;
    const saved = getPreference(storageKey);
    if (saved) {
      setColumnVisibility(saved);
      isInitialMount.current = false;
    }
  }, [storageKey, getPreference]);

  // Track previous resetFilterKey to detect changes
  const prevResetFilterKeyRef = useRef<string | undefined>(undefined);

  // Reset employee filter when department changes
  useEffect(() => {
    if (
      resetFilterKey !== undefined &&
      prevResetFilterKeyRef.current !== undefined &&
      prevResetFilterKeyRef.current !== resetFilterKey
    ) {
      setActiveFilters((prev) => {
        const newFilters = { ...prev };
        const employeeFilter = filters?.find((f) => f.key === "employeeId");
        if (employeeFilter && prev[employeeFilter.key]) {
          delete newFilters[employeeFilter.key];
        }
        return newFilters;
      });
    }
    prevResetFilterKeyRef.current = resetFilterKey;
  }, [resetFilterKey, filters]);

  useEffect(() => {
    if (newItemId) {
      setHighlightedId(newItemId);
      const timeout = setTimeout(() => {
        setHighlightedId(null);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [newItemId]);

  // Save column visibility to AuthProvider whenever it changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!storageKey) return;

    updatePreference(storageKey, columnVisibility);
  }, [columnVisibility, storageKey, updatePreference]);

  const handleDeleteRows = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const updatedData = data.filter(
      (item) => !selectedRows.some((row) => row.original.id === item.id)
    );
    const selectedRowIds = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id);
    onMultiDelete?.(selectedRowIds);
    setData(updatedData);
    table.resetRowSelection();
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (onSearchChange) {
      // Debounce server-side search by 400ms
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 400);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters((prev) => {
      const newFilters = {
        ...prev,
        [key]: value,
      };
      onFilterChange?.(key, value);
      return newFilters;
    });
  };

  return (
    <SearchHighlightContext.Provider value={search}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {searchFields?.length && (
              <div className="relative md:w-auto w-full">
                <Input
                  id={`${id}-input`}
                  name="filter"
                  ref={inputRef}
                  className="peer min-w-60 ps-9"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={`Search by ${searchFields
                    .map((f) => f.label)
                    .join(", ")}`}
                  type="text"
                />

                <div className="absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
                  <ListFilterIcon size={16} aria-hidden="true" />
                </div>

                {search && (
                  <button
                    className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-muted-foreground"
                    onClick={() => {
                      setSearch("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear filter"
                  >
                    <CircleXIcon size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {/* Filter dropdowns */}
            {filters?.map((filter) => {
              const isWideFilter =
                filter.key === "department" || filter.key === "employeeId";
              const widthClass = isWideFilter ? "w-[220px]" : "w-[150px]";

              return (
                <Autocomplete
                  key={filter.key}
                  options={[
                    { value: "all", label: `All ${filter.label}` },
                    ...filter.options,
                  ]}
                  value={activeFilters[filter.key] || "all"}
                  onValueChange={(value) =>
                    handleFilterChange(filter.key, value)
                  }
                  placeholder={`Select ${filter.label}`}
                  searchPlaceholder={`Search ${filter.label}...`}
                  className={widthClass}
                />
              );
            })}
          </div>
          {isMobile && <Separator />}
          <div className="flex items-center gap-3">
            {table.getSelectedRowModel().rows.length > 0 && (
              <>
                {onBulkEdit && canBulkEdit && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const selectedItems = table
                        .getSelectedRowModel()
                        .rows.map((row) => row.original);
                      onBulkEdit(selectedItems);
                    }}
                    className="bg-primary/5! border-primary/50! text-primary"
                  >
                    <PencilIcon className="-ms-1 opacity-60" size={16} />
                    Edit
                    <span className="ml-1 text-xs">
                      ({table.getSelectedRowModel().rows.length})
                    </span>
                  </Button>
                )}
                {onMultiDelete && canBulkDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="bg-destructive/5! border-destructive/50! text-destructive"
                      >
                        <TrashIcon className="-ms-1 opacity-60" size={16} />{" "}
                        Delete
                        <span className="ml-1 text-xs">
                          ({table.getSelectedRowModel().rows.length})
                        </span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete the selected rows.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteRows}
                          className="bg-destructive"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}{" "}
            {/* Toggle columns visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Columns3Icon className="-ms-1 opacity-60" size={16} /> View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                {table
                  .getAllColumns()
                  .filter((col) => col.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>{" "}
            {/* Add button */}
            {toggleAction && (
              <Button onClick={toggleAction}>
                <PlusIcon className="-ms-1 opacity-60" size={16} /> {actionText}
              </Button>
            )}
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm w-full max-w-full">
          <div className="relative w-full">
            {/* Left scroll fade indicator */}
            {canScrollLeft && (
              <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-12 bg-gradient-to-r from-card/80 to-transparent rounded-l-lg" />
            )}
            {/* Right scroll fade + chevron indicator */}
            {canScrollRight && (
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-16 bg-gradient-to-l from-card/90 to-transparent rounded-r-lg flex items-center justify-end pr-2">
                <ChevronRightIcon size={18} className="text-muted-foreground animate-pulse" />
              </div>
            )}
            <div
              ref={scrollContainerRef}
              className="w-full overflow-x-auto"
            >
            <table className="min-w-full caption-bottom text-sm table-auto">
              <thead className={cn("sticky top-0 z-10 bg-muted/80 backdrop-blur-sm [&_tr]:border-b")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent border-b border-border/50 bg-muted/30"
                  >
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          style={{ width: `${header.getSize()}px` }}
                          className="h-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <div
                              className={cn(
                                header.column.getCanSort() &&
                                "flex h-full cursor-pointer items-center justify-between gap-2 select-none hover:text-foreground transition-colors"
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                              onKeyDown={(e) => {
                                if (
                                  header.column.getCanSort() &&
                                  (e.key === "Enter" || e.key === " ")
                                ) {
                                  e.preventDefault();
                                  header.column.getToggleSortingHandler()?.(e);
                                }
                              }}
                              tabIndex={
                                header.column.getCanSort() ? 0 : undefined
                              }
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {{
                                asc: (
                                  <ChevronUpIcon
                                    className="shrink-0 text-primary animate-in slide-in-from-bottom-1 fade-in duration-200"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                ),
                                desc: (
                                  <ChevronDownIcon
                                    className="shrink-0 text-primary animate-in slide-in-from-top-1 fade-in duration-200"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                ),
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={tableColumns.length}
                      className="h-32 text-center p-2 align-middle"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Loading data...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row, index) => {
                    const isNew = row.original.id === highlightedId;

                    return (
                      <motion.tr
                        key={row.id}
                        layout="position"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                        data-state={row.getIsSelected() && "selected"}
                        className={cn(
                          "border-b border-border/30 transition-colors",
                          index % 2 === 0 ? "bg-transparent" : "bg-muted/20",
                          "hover:bg-accent/50",
                          rowClassName ? rowClassName(row.original) : "",
                          isNew &&
                          "bg-primary/10 animate-pulse ring-1 ring-primary/30"
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="h-32 text-center text-muted-foreground p-2 align-middle"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-lg">No results found</span>
                        <span className="text-sm">
                          Try adjusting your search or filters
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-8 md:flex-row flex-col">
          {/* Rows per page dropdown */}
          <div className="flex items-center gap-2 order-3 md:order-1">
            <Label htmlFor="pageSize">Rows per page</Label>
            <Select
              value={pagination.pageSize.toString()}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page numbers with animation */}
          <div className="flex items-center gap-1 order-1 md:order-2">
            {getPageNumbers({
              currentPage: table.getState().pagination.pageIndex,
              totalPages: table.getPageCount(),
            }).map((page, idx) =>
              page === "..." ? (
                <PageJumpDropdown
                  key={idx}
                  totalPages={table.getPageCount()}
                  onSelect={(page) => table.setPageIndex(page - 1)}
                />
              ) : (
                <Button
                  key={idx}
                  size="sm"
                  variant={
                    page === table.getState().pagination.pageIndex + 1
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => table.setPageIndex((page as number) - 1)}
                >
                  {page}
                </Button>
              )
            )}
          </div>

          <div className="items-center gap-2 order-2 md:order-3">
            {/* Page number range info */}
            <div className="text-muted-foreground flex grow justify-end text-sm whitespace-nowrap">
              <p
                className="text-muted-foreground text-sm whitespace-nowrap"
                aria-live="polite"
              >
                <span className="text-foreground">
                  {table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    1}
                  -
                  {Math.min(
                    table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    table.getState().pagination.pageSize,
                    table.getRowCount()
                  )}
                </span>{" "}
                of{" "}
                <span className="text-foreground">
                  {table.getRowCount().toString()}
                </span>
              </p>
            </div>

            {/* Navigation arrows */}
            <div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => table.firstPage()}
                      disabled={!table.getCanPreviousPage()}
                      aria-label="Go to first page"
                    >
                      <ChevronFirstIcon size={16} />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      aria-label="Go to previous page"
                    >
                      <ChevronLeftIcon size={16} />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      aria-label="Go to next page"
                    >
                      <ChevronRightIcon size={16} />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => table.lastPage()}
                      disabled={!table.getCanNextPage()}
                      aria-label="Go to last page"
                    >
                      <ChevronLastIcon size={16} />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </div>
      </div>
    </SearchHighlightContext.Provider>
  );
}

function getPageNumbers({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}): (number | "...")[] {
  const pages: (number | "...")[] = [];

  const start = Math.max(1, currentPage + 1 - 2);
  const end = Math.min(totalPages, currentPage + 1 + 2);

  if (start > 1) pages.push(1);
  if (start > 2) pages.push("...");

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) pages.push("...");
  if (end < totalPages) pages.push(totalPages);

  return pages;
}

type PageJumpDropdownProps = {
  totalPages: number;
  onSelect: (page: number) => void;
};

export function PageJumpDropdown({
  totalPages,
  onSelect,
}: PageJumpDropdownProps) {
  const [search, setSearch] = useState("");

  const filtered = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p.toString().includes(search)
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-muted-foreground hover:text-primary"
        >
          ...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2">
        <Input
          name="page-jump-search"
          placeholder="Go to page..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <ScrollArea className="h-40">
          {filtered.map((page) => (
            <Button
              key={page}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onSelect(page);
              }}
            >
              Page {page}
            </Button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
