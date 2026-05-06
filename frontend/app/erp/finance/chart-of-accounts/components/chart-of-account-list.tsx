"use client";

import * as React from "react";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, Folder, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartOfAccountListProps {
  initialData: ChartOfAccount[];
  permissions?: {
    canUpdate: boolean;
    canDelete: boolean;
  };
}

const pkrFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
});

// ---------------------------------------------------------------------------
// Build tree once from flat list
// ---------------------------------------------------------------------------
function buildTree(flat: ChartOfAccount[]): ChartOfAccount[] {
  const map = new Map<string, ChartOfAccount>();
  const roots: ChartOfAccount[] = [];

  flat.forEach((item) => map.set(item.id, { ...item, children: [] }));

  flat.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// ---------------------------------------------------------------------------
// Flatten visible rows based on expanded set (pure function, no React state)
// ---------------------------------------------------------------------------
function flattenVisible(
  nodes: ChartOfAccount[],
  expandedIds: Set<string>,
  depth = 0,
  result: Array<{ node: ChartOfAccount; depth: number }> = []
): Array<{ node: ChartOfAccount; depth: number }> {
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.children?.length && expandedIds.has(node.id)) {
      flattenVisible(node.children, expandedIds, depth + 1, result);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Collect all group IDs for "expand all" default
// ---------------------------------------------------------------------------
function collectGroupIds(nodes: ChartOfAccount[], out = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.isGroup && node.children?.length) {
      out.add(node.id);
      collectGroupIds(node.children, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Row — memoized, re-renders only when its own expanded state changes
// ---------------------------------------------------------------------------
const AccountRow = React.memo(
  ({
    node,
    depth,
    isExpanded,
    hasChildren,
    onToggle,
  }: {
    node: ChartOfAccount;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggle: (id: string) => void;
  }) => {
    const indentSize = 24;

    return (
      <tr
        className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {/* Name cell */}
        <td className="p-0 relative">
          <div className="flex items-center h-full w-full py-2 pr-4 relative">
            {/* Vertical guide lines */}
            {Array.from({ length: depth }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-border/40"
                style={{ left: `${i * indentSize + 12}px` }}
              />
            ))}

            <div
              className="flex items-center"
              style={{ paddingLeft: `${depth * indentSize}px` }}
            >
              {/* L-shape connector */}
              {depth > 0 && (
                <div
                  className="absolute w-3 h-px bg-border/40"
                  style={{ left: `${(depth - 1) * indentSize + 12}px` }}
                />
              )}

              {hasChildren ? (
                <span
                  className="mr-1 p-0.5 rounded-sm hover:bg-muted z-10 inline-flex"
                  style={{
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 150ms ease",
                  }}
                >
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </span>
              ) : (
                <span className="w-5 mr-1" />
              )}

              {node.isGroup ? (
                <Folder className="mr-2 h-4 w-4 shrink-0 text-blue-500 fill-blue-500/20" />
              ) : (
                <FileText className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
              )}

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground/70">
                  {node.code}
                </span>
                <span
                  className={cn(
                    "truncate",
                    node.isGroup
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {node.name}
                </span>
              </div>
            </div>
          </div>
        </td>

        {/* Type */}
        <td className="py-2 px-4">
          <Badge variant="outline" className="font-normal">
            {node.type}
          </Badge>
        </td>

        {/* Group */}
        <td className="py-2 px-4">
          <Checkbox checked={node.isGroup} disabled className="opacity-70" />
        </td>

        {/* Active */}
        <td className="py-2 px-4">
          <Badge
            variant={node.isActive ? "default" : "secondary"}
            className="rounded-full"
          >
            {node.isActive ? "Active" : "Inactive"}
          </Badge>
        </td>

        {/* Balance */}
        <td className="py-2 px-4 text-right font-medium font-mono">
          {pkrFormatter.format(node.balance).replace("PKR", "Rs.")}
        </td>
      </tr>
    );
  }
);
AccountRow.displayName = "AccountRow";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ChartOfAccountList({ initialData }: ChartOfAccountListProps) {
  const tree = React.useMemo(() => buildTree(initialData), [initialData]);

  // Start with all groups expanded
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => collectGroupIds(tree)
  );

  const [filter, setFilter] = React.useState("");

  const toggle = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Filter: if searching, show all matching nodes (ignore expand state)
  const visibleRows = React.useMemo(() => {
    if (!filter.trim()) {
      return flattenVisible(tree, expandedIds);
    }

    const q = filter.toLowerCase();
    const matched: Array<{ node: ChartOfAccount; depth: number }> = [];

    function search(nodes: ChartOfAccount[], depth: number) {
      for (const node of nodes) {
        if (
          node.name.toLowerCase().includes(q) ||
          node.code.toLowerCase().includes(q)
        ) {
          matched.push({ node, depth: 0 }); // flatten for search results
        }
        if (node.children?.length) search(node.children, depth + 1);
      }
    }
    search(tree, 0);
    return matched;
  }, [tree, expandedIds, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter by name or code..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50">
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Group</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Active</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Balance</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {visibleRows.length ? (
              visibleRows.map(({ node, depth }) => (
                <AccountRow
                  key={node.id}
                  node={node}
                  depth={depth}
                  isExpanded={expandedIds.has(node.id)}
                  hasChildren={!!node.children?.length}
                  onToggle={toggle}
                />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="h-24 text-center text-muted-foreground">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center py-4">
        <span className="text-sm text-muted-foreground">
          {visibleRows.length} row(s)
        </span>
      </div>
    </div>
  );
}
