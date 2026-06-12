"use client";

import * as React from "react";
import {
    CheckIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    Loader2,
    Search,
    BookOpen,
    FolderOpen,
    Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { authFetch } from "@/lib/auth";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";

// ─── Module-level cache ───────────────────────────────────────────────────────
let _cachedTree: ChartOfAccount[] | null = null;
let _fetchPromise: Promise<ChartOfAccount[]> | null = null;

/** Expose the cached tree so consumers can read children without extra fetches. */
export function getSharedTree(): ChartOfAccount[] {
    return _cachedTree ?? [];
}

async function fetchTree(): Promise<ChartOfAccount[]> {
    if (_cachedTree) return _cachedTree;
    if (_fetchPromise) return _fetchPromise;

    _fetchPromise = authFetch("/finance/chart-of-accounts/tree", {})
        .then((res) => {
            const data = res.data;
            const tree: ChartOfAccount[] = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : [];
            _cachedTree = tree;
            return tree;
        })
        .catch(() => {
            _fetchPromise = null;
            return [];
        });

    return _fetchPromise;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten the entire tree into a single array (depth-first). */
function flattenTree(nodes: ChartOfAccount[]): ChartOfAccount[] {
    const result: ChartOfAccount[] = [];
    function walk(list: ChartOfAccount[]) {
        for (const node of list) {
            result.push(node);
            if (node.children?.length) walk(node.children);
        }
    }
    walk(nodes);
    return result;
}

/** Find a node anywhere in the tree by id. */
function findById(nodes: ChartOfAccount[], id: string): ChartOfAccount | undefined {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children?.length) {
            const found = findById(node.children, id);
            if (found) return found;
        }
    }
    return undefined;
}

// ─── Type badge config ────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
    ASSET:     { label: "Asset",     className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    LIABILITY: { label: "Liability", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    EQUITY:    { label: "Equity",    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    REVENUE:   { label: "Revenue",   className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    EXPENSE:   { label: "Expense",   className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

/** Recursively filter out an account and its descendants from the tree. */
function filterTreeExclude(nodes: ChartOfAccount[], excludeId?: string): ChartOfAccount[] {
    if (!excludeId) return nodes;
    return nodes
        .filter((node) => node.id !== excludeId)
        .map((node) => ({
            ...node,
            children: node.children ? filterTreeExclude(node.children, excludeId) : [],
        }));
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface ChartOfAccountSelectProps {
    /** Pre-loaded tree (optional). If omitted, the component fetches lazily. */
    accounts?: ChartOfAccount[];
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    allowGroups?: boolean;
    groupsOnly?: boolean;
    excludeAccountId?: string;
}

// ─── Tree row ─────────────────────────────────────────────────────────────────
interface TreeRowProps {
    node: ChartOfAccount;
    depth: number;
    expanded: Set<string>;
    onToggle: (id: string) => void;
    selectedId?: string;
    onSelect: (id: string) => void;
    allowGroups?: boolean;
    groupsOnly?: boolean;
}

function TreeRow({
    node,
    depth,
    expanded,
    onToggle,
    selectedId,
    onSelect,
    allowGroups = false,
    groupsOnly = false,
}: TreeRowProps) {
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = (node.children?.length ?? 0) > 0;

    const isSelectable = groupsOnly
        ? node.isGroup
        : (allowGroups ? true : !node.isGroup);
    const isInteractive = isSelectable || hasChildren;

    return (
        <>
            <div
                role="option"
                aria-selected={isSelected}
                aria-expanded={hasChildren ? isExpanded : undefined}
                onClick={() => {
                    if (isSelectable) {
                        onSelect(node.id);
                        if (hasChildren) onToggle(node.id);
                    } else if (node.isGroup) {
                        onToggle(node.id);
                    }
                }}
                style={{ paddingLeft: `${8 + depth * 16}px` }}
                className={cn(
                    "flex items-center gap-2 py-1.5 pr-3 rounded-md select-none text-sm",
                    isInteractive
                        ? "cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                        : "cursor-default opacity-50",
                    isSelected && "bg-accent font-medium",
                    node.isGroup && "text-muted-foreground"
                )}
            >
                {/* Expand / collapse chevron */}
                <span
                    onClick={(e) => {
                        if (hasChildren) {
                            e.stopPropagation();
                            onToggle(node.id);
                        }
                    }}
                    className={cn(
                        "shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors",
                        hasChildren ? "cursor-pointer hover:bg-accent-foreground/10" : "pointer-events-none opacity-0"
                    )}
                >
                    {hasChildren ? (
                        isExpanded ? (
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronRightIcon className="h-3.5 w-3.5" />
                        )
                    ) : null}
                </span>

                {/* Icon */}
                {node.isGroup ? (
                    isExpanded ? (
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )
                ) : (
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}

                {/* Code + name */}
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">{node.code}</span>
                <span className="flex-1 min-w-0 truncate">{node.name}</span>

                {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-primary ml-auto" />}
            </div>

            {/* Children — rendered when expanded (works for both group and non-group parents) */}
            {isExpanded && node.children?.map((child) => (
                <TreeRow
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    expanded={expanded}
                    onToggle={onToggle}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    allowGroups={allowGroups}
                    groupsOnly={groupsOnly}
                />
            ))}
        </>
    );
}

// ─── Search result row ────────────────────────────────────────────────────────
interface SearchRowProps {
    account: ChartOfAccount;
    selectedId?: string;
    onSelect: (id: string) => void;
    /** Breadcrumb path from root to this node */
    breadcrumb: string;
}

function SearchRow({ account, selectedId, onSelect, breadcrumb }: SearchRowProps) {
    const isSelected = selectedId === account.id;
    return (
        <div
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(account.id)}
            className={cn(
                "flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer select-none",
                "hover:bg-accent hover:text-accent-foreground transition-colors",
                isSelected && "bg-accent"
            )}
        >
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">{account.code}</span>
                    <span className={cn("text-sm truncate", isSelected && "font-medium")}>{account.name}</span>
                </div>
                {breadcrumb && (
                    <span className="text-[10px] text-muted-foreground truncate">{breadcrumb}</span>
                )}
            </div>
            {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-primary mt-0.5" />}
        </div>
    );
}

// ─── Build breadcrumb map ─────────────────────────────────────────────────────
function buildBreadcrumbs(
    nodes: ChartOfAccount[],
    parentPath = ""
): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of nodes) {
        const path = parentPath ? `${parentPath} › ${node.name}` : node.name;
        map.set(node.id, parentPath); // store parent path (not self)
        if (node.children?.length) {
            const childMap = buildBreadcrumbs(node.children, path);
            childMap.forEach((v, k) => map.set(k, v));
        }
    }
    return map;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ChartOfAccountSelect({
    accounts: accountsProp,
    value,
    onValueChange,
    placeholder = "Select Account",
    disabled = false,
    className,
    allowGroups = false,
    groupsOnly = false,
    excludeAccountId,
}: ChartOfAccountSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [tree, setTree] = React.useState<ChartOfAccount[]>(
        accountsProp ?? _cachedTree ?? []
    );
    const [isLoading, setIsLoading] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

    // Lazy-fetch on first open
    React.useEffect(() => {
        if (accountsProp) {
            setTree(accountsProp);
            return;
        }
        if (!open || tree.length > 0) return;

        setIsLoading(true);
        fetchTree().then((data) => {
            setTree(data);
            setIsLoading(false);
        });
    }, [open, accountsProp, tree.length]);

    // Sync prop changes
    React.useEffect(() => {
        if (accountsProp) setTree(accountsProp);
    }, [accountsProp]);

    // Reset search + collapse on close
    React.useEffect(() => {
        if (!open) {
            setSearch("");
        }
    }, [open]);

    // ── Derived ────────────────────────────────────────────────────────────────
    const filteredTree = React.useMemo(() => {
        return filterTreeExclude(tree, excludeAccountId);
    }, [tree, excludeAccountId]);

    const allFlat = React.useMemo(() => flattenTree(filteredTree), [filteredTree]);

    const breadcrumbMap = React.useMemo(() => buildBreadcrumbs(filteredTree), [filteredTree]);

    /**
     * Search results: filtered depending on groupsOnly/allowGroups.
     */
    const searchResults = React.useMemo(() => {
        if (!search.trim()) return [];
        const q = search.trim().toLowerCase();
        return allFlat.filter((a) => {
            if (groupsOnly) {
                if (!a.isGroup) return false;
            } else if (!allowGroups) {
                if (a.isGroup) return false;
            }
            return (
                a.code.toLowerCase().includes(q) ||
                a.name.toLowerCase().includes(q) ||
                a.type.toLowerCase().includes(q)
            );
        });
    }, [allFlat, search, groupsOnly, allowGroups]);

    const selectedAccount = React.useMemo(
        () => (value ? findById(filteredTree, value) : undefined),
        [filteredTree, value]
    );

    const displayLabel = selectedAccount
        ? `${selectedAccount.code} - ${selectedAccount.name}`
        : null;

    // ── Handlers ───────────────────────────────────────────────────────────────
    function toggleExpand(id: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function handleSelect(id: string) {
        onValueChange?.(value === id ? "" : id);
        setOpen(false);
    }

    const isSearching = search.trim().length > 0;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    disabled={disabled}
                    className={cn(
                        "flex items-center w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-normal cursor-pointer select-none text-left",
                        "hover:bg-accent hover:text-accent-foreground transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        open && "ring-2 ring-ring/20",
                        disabled && "pointer-events-none opacity-50",
                        className
                    )}
                >
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground mr-2" />
                    <span className={cn("flex-1 min-w-0 truncate", !displayLabel && "text-muted-foreground")}>
                        {displayLabel ?? placeholder}
                    </span>
                    {selectedAccount && (
                        <span
                            className={cn(
                                "ml-2 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                                TYPE_CONFIG[selectedAccount.type]?.className ?? "bg-muted text-muted-foreground"
                            )}
                        >
                            {TYPE_CONFIG[selectedAccount.type]?.label ?? selectedAccount.type}
                        </span>
                    )}
                    <ChevronDownIcon
                        className={cn(
                            "ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                            open && "rotate-180"
                        )}
                    />
                </button>
            </PopoverTrigger>

            <PopoverContent
                className="w-(--radix-popover-trigger-width) min-w-80 p-0"
                align="start"
                sideOffset={4}
            >
                {/* Search bar */}
                <div className="flex items-center border-b px-3 gap-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search by code or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="max-h-80 overflow-y-auto p-1" role="listbox">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Loading accounts...</span>
                        </div>
                    ) : isSearching ? (
                        /* ── Search mode ── */
                        searchResults.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No accounts found.
                            </div>
                        ) : (
                            searchResults.map((acc) => (
                                <SearchRow
                                    key={acc.id}
                                    account={acc}
                                    selectedId={value}
                                    onSelect={handleSelect}
                                    breadcrumb={breadcrumbMap.get(acc.id) ?? ""}
                                />
                            ))
                        )
                    ) : (
                        /* ── Tree mode ── */
                        filteredTree.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No accounts available.
                            </div>
                        ) : (
                            filteredTree.map((node) => (
                                <TreeRow
                                    key={node.id}
                                    node={node}
                                    depth={0}
                                    expanded={expanded}
                                    onToggle={toggleExpand}
                                    selectedId={value}
                                    onSelect={handleSelect}
                                    allowGroups={allowGroups}
                                    groupsOnly={groupsOnly}
                                />
                            ))
                        )
                    )}
                </div>

                {/* Footer */}
                {!isLoading && allFlat.length > 0 && (
                    <div className="border-t px-3 py-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                            {isSearching
                                ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
                                : groupsOnly
                                    ? `${allFlat.filter((a) => a.isGroup).length} groups`
                                    : `${allFlat.filter((a) => !a.isGroup).length} accounts`}
                        </span>
                        {value && (
                            <button
                                type="button"
                                onClick={() => { onValueChange?.(""); setOpen(false); }}
                                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                            >
                                Clear selection
                            </button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
