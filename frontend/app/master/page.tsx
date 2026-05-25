"use client";

import React from "react";
import Link from "next/link";
import { Search, Database, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { masterMenuData, filterMenuByPermissions, type MenuItem } from "@/components/dashboard/sidebar-menu-data";
import { useAuth } from "@/components/providers/auth-provider";

// ─── Flatten masterMenuData into a list of navigable entries ─────────────────
interface MasterEntry {
    title: string;
    href: string;
    /** Parent group title (e.g. "Department") */
    group: string;
    /** First child action label (e.g. "View") */
    action: string;
}

function flattenToEntries(items: MenuItem[]): MasterEntry[] {
    const entries: MasterEntry[] = [];
    for (const item of items) {
        if (item.href) {
            // Leaf item with direct href
            entries.push({
                title: item.title,
                href: item.href,
                group: item.title,
                action: "Open",
            });
        } else if (item.children) {
            // Group — find the "View" or "List" child as the primary link
            const viewChild =
                item.children.find((c) => c.title === "View" || c.title === "List") ??
                item.children[0];
            if (viewChild?.href) {
                entries.push({
                    title: item.title,
                    href: viewChild.href,
                    group: item.title,
                    action: viewChild.title,
                });
            }
        }
    }
    return entries;
}

// ─── Alphabetical group buckets ───────────────────────────────────────────────
function groupAlphabetically(entries: MasterEntry[]): Map<string, MasterEntry[]> {
    const map = new Map<string, MasterEntry[]>();
    const sorted = [...entries].sort((a, b) => a.title.localeCompare(b.title));
    for (const entry of sorted) {
        const letter = entry.title[0].toUpperCase();
        if (!map.has(letter)) map.set(letter, []);
        map.get(letter)!.push(entry);
    }
    return map;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MasterPage() {
    const { hasAnyPermission, hasAllPermissions, isAdmin } = useAuth();
    const [search, setSearch] = React.useState("");

    // Filter masterMenuData by user permissions
    const accessibleItems = React.useMemo(
        () =>
            filterMenuByPermissions(masterMenuData, {
                hasAnyPermission,
                hasAllPermissions,
                isAdmin,
            }),
        [hasAnyPermission, hasAllPermissions, isAdmin]
    );

    const allEntries = React.useMemo(() => flattenToEntries(accessibleItems), [accessibleItems]);

    const filtered = React.useMemo(() => {
        if (!search.trim()) return allEntries;
        const q = search.trim().toLowerCase();
        return allEntries.filter((e) => e.title.toLowerCase().includes(q));
    }, [allEntries, search]);

    const grouped = React.useMemo(() => groupAlphabetically(filtered), [filtered]);

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div className="border-b px-6 py-5 bg-background">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-rose-500/10">
                        <Database className="h-5 w-5 text-rose-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold leading-none">Master Data</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {allEntries.length} modules available
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search modules..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9"
                        autoFocus
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Database className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No modules found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Try a different search term
                        </p>
                    </div>
                ) : search.trim() ? (
                    // ── Flat search results ──
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filtered.map((entry) => (
                            <MasterCard key={entry.href} entry={entry} />
                        ))}
                    </div>
                ) : (
                    // ── Alphabetical groups ──
                    <div className="space-y-8">
                        {[...grouped.entries()].map(([letter, entries]) => (
                            <section key={letter}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest w-5">
                                        {letter}
                                    </span>
                                    <div className="flex-1 h-px bg-border" />
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                        {entries.length}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {entries.map((entry) => (
                                        <MasterCard key={entry.href} entry={entry} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Card component ───────────────────────────────────────────────────────────
function MasterCard({ entry }: { entry: MasterEntry }) {
    return (
        <Link
            href={entry.href}
            // @ts-ignore — transitionTypes is a custom prop used by the page transition system
            transitionTypes={["nav-forward"]}
            className={cn(
                "group flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3",
                "hover:bg-accent hover:border-accent-foreground/10 hover:shadow-sm",
                "transition-all duration-150 cursor-pointer"
            )}
        >
            <div className="min-w-0">
                <p className="text-sm font-medium truncate leading-none">{entry.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{entry.action}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </Link>
    );
}
