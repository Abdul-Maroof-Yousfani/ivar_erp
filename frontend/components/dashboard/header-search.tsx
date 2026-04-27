"use client";

import { useState, useMemo, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { addTransitionType } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { menuData, masterMenuData, flattenMenu, filterMenuByPermissions } from "./sidebar-menu-data";
import { useAuth } from "@/components/providers/auth-provider";
import { Search, Loader2, User, Package, Truck, FileText, Compass, Command as CommandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";

interface SearchResult {
  type: 'Employee' | 'Item' | 'Supplier' | 'RFQ';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface HeaderSearchProps {
  onNavigate?: () => void;
}

export function HeaderSearch({ onNavigate }: HeaderSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { hasAnyPermission, hasAllPermissions, isAdmin } = useAuth();

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced DB Search
  useEffect(() => {
    if (!search || search.length < 2) {
      setDbResults([]);
      return;
    }

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/search`, {
          params: { q: search },
          signal: controller.signal
        });
        if (res.ok && res.data?.status) {
          setDbResults(res.data.data);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Search failed:", error);
        }
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [search]);

  const filteredMenuTree = useMemo(
    () =>
      filterMenuByPermissions(menuData, {
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
      }),
    [hasAnyPermission, hasAllPermissions, isAdmin]
  );

  const filteredMasterMenuTree = useMemo(
    () =>
      filterMenuByPermissions(masterMenuData, {
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
      }),
    [hasAnyPermission, hasAllPermissions, isAdmin]
  );

  const flatMenu = useMemo(() => {
    const main = flattenMenu(filteredMenuTree);
    const master = flattenMenu(filteredMasterMenuTree);
    const merged = [...main, ...master];
    // De-duplicate by href — same route can appear in both menuData and masterMenuData
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [filteredMenuTree, filteredMasterMenuTree]);

  const filteredNav = useMemo(() => {
    if (!search) return flatMenu.slice(0, 5);
    return flatMenu.filter(
      (item) =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.path.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);
  }, [search, flatMenu]);

  const resultsByCategory = useMemo(() => {
    const categories: Record<string, SearchResult[]> = {
      Employee: [],
      Item: [],
      Supplier: [],
      RFQ: [],
    };
    dbResults.forEach(res => {
      if (categories[res.type]) {
        categories[res.type].push(res);
      }
    });
    return categories;
  }, [dbResults]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearch("");
    onNavigate?.();
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push(href);
    });
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'Employee': return <User className="mr-2 h-4 w-4" />;
      case 'Item': return <Package className="mr-2 h-4 w-4" />;
      case 'Supplier': return <Truck className="mr-2 h-4 w-4" />;
      case 'RFQ': return <FileText className="mr-2 h-4 w-4" />;
      default: return <Compass className="mr-2 h-4 w-4" />;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <span className="inline-flex items-center">
          <Search className="mr-2 h-4 w-4" />
          <span>Search...</span>
        </span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Global Search (Employees, Items, Suppliers, RFQs, Navigation...)"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[70vh]">
          <CommandEmpty>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Searching database...</span>
              </div>
            ) : (
              "No results found."
            )}
          </CommandEmpty>

          {filteredNav.length > 0 && (
            <CommandGroup heading="Navigation">
              {filteredNav.map((item, index) => (
                <CommandItem
                  key={`nav-${index}-${item.href}`}
                  value={`nav-${item.title}-${item.path}`}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Compass className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.path}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {Object.entries(resultsByCategory).map(([category, items]) => (
            items.length > 0 && (
              <CommandGroup key={category} heading={category + "s"}>
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.type}-${item.title}-${item.subtitle}`}
                    onSelect={() => handleSelect(item.href)}
                  >
                    {getResultIcon(item.type)}
                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          ))}

          {search && !loading && dbResults.length > 0 && (
            <>
              <CommandSeparator />
              <div className="px-4 py-2 text-[10px] text-muted-foreground">
                Showing top results from database
              </div>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
