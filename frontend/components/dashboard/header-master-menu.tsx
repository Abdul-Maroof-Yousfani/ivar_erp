"use client";

import { useState, useMemo, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Database, ChevronRight, Search, LayoutGrid, Users, Package, Monitor } from "lucide-react";
import { masterMenuData, MenuItem, filterMenuByPermissions } from "./sidebar-menu-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

function getCategoryLabel(environment?: string) {
  switch (environment) {
    case "HR": return "HRM";
    case "ERP": return "ERP";
    case "POS": return "POS";
    default: return "";
  }
}

function MasterMenuItem({
  item,
  pathname,
  onNavigate,
  showCategory = false,
  depth = 0,
}: {
  item: MenuItem;
  pathname: string;
  onNavigate: (href: string, e: React.MouseEvent) => void;
  showCategory?: boolean;
  depth?: number;
}) {
  const hasChildren = item.children && item.children.length > 0;

  // Recursive function to check if any child (at any depth) is active
  const isAnyChildActive = useMemo(() => {
    const checkActive = (i: MenuItem): boolean => {
      if (i.href === pathname) return true;
      if (i.children) return i.children.some(checkActive);
      return false;
    };
    return item.children?.some(checkActive) || false;
  }, [item.children, pathname]);

  if (hasChildren) {
    return (
      <Collapsible defaultOpen={isAnyChildActive}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground group/trigger">
          <div className="flex flex-col items-start gap-0.5">
            <span>{item.title}</span>
            {showCategory && item.environment && depth === 0 && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {getCategoryLabel(item.environment)}
              </span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/trigger:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={cn(
            "mt-1 space-y-1",
            depth === 0 ? "ml-4 border-l pl-2" : "ml-4 border-l pl-2"
          )}>
            {item.children?.map((child, index) => (
              <MasterMenuItem
                key={`${child.title}-${index}`}
                item={child}
                pathname={pathname}
                onNavigate={onNavigate}
                showCategory={showCategory}
                depth={depth + 1}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <button
      onClick={(e) => item.href && onNavigate(item.href, e)}
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left",
        pathname === item.href && "bg-accent text-accent-foreground font-medium"
      )}
    >
      <div className="flex flex-col items-start gap-0.5">
        <span>{item.title}</span>
        {showCategory && item.environment && depth === 0 && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            {getCategoryLabel(item.environment)}
          </span>
        )}
      </div>
    </button>
  );
}

export function HeaderMasterMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("POS");
  const { hasAnyPermission, hasAllPermissions, isAdmin } = useAuth();

  const filteredMasterMenu = useMemo(
    () =>
      filterMenuByPermissions(masterMenuData, {
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
      }),
    [hasAnyPermission, hasAllPermissions, isAdmin]
  );

  const filteredMenu = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    if (searchLower) {
      const results = filteredMasterMenu.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(searchLower);
        const childMatch = item.children?.some((child) =>
          child.title.toLowerCase().includes(searchLower)
        );
        return titleMatch || childMatch;
      });
      return { results, isSearch: true };
    }

    return {
      POS: filteredMasterMenu.filter(item => item.environment === "POS" || item.environment === "BOTH"),
      HRM: filteredMasterMenu.filter(item => item.environment === "HR"),
      ERP: filteredMasterMenu.filter(item => item.environment === "ERP"),
      isSearch: false
    };
  }, [search, filteredMasterMenu]);

  const handleClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push(href);
    });
  };

  if (filteredMasterMenu.length === 0) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Database className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span className="sr-only">Master Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[380px] sm:w-[440px] px-0 py-0 gap-0 border-l shadow-2xl">
        <div className="flex flex-col h-full bg-background/95 backdrop-blur-md">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-3 font-bold tracking-tight">
                <div className="p-1 rounded-xl bg-primary/10 text-primary">
                  <Database className="h-4 w-4" />
                </div>
                Master Repository
              </SheetTitle>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search master records..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-8 bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-xl"
              />
            </div>
          </SheetHeader>

          {filteredMenu.isSearch ? (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1" showShadows>
                <div className="px-6 py-4 space-y-1">
                  {(filteredMenu as any).results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="p-4 rounded-full bg-secondary/50 mb-3">
                        <Search className="h-8 w-8 opacity-20" />
                      </div>
                      <p className="text-sm font-medium">No results found</p>
                      <p className="text-xs opacity-70">Try searching for something else</p>
                    </div>
                  ) : (
                    <div className="grid gap-1.5 animate-in fade-in duration-300">
                      {(filteredMenu as any).results.map((item: any) => (
                        <MasterMenuItem
                          key={item.title}
                          item={item}
                          pathname={pathname}
                          onNavigate={handleClick}
                          showCategory={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0" variant="underline">
              <div className="px-0 pt-3 border-b bg-secondary/20 overflow-x-auto">
                <TabsList className={cn(
                  "grid w-full grid-cols-3 min-w-max",
                  Object.keys(filteredMenu).filter(k => k !== 'isSearch' && (filteredMenu as any)[k].length > 0).length === 2 && "grid-cols-2",
                  Object.keys(filteredMenu).filter(k => k !== 'isSearch' && (filteredMenu as any)[k].length > 0).length === 1 && "grid-cols-1",
                )}>
                  {(filteredMenu as any).POS?.length > 0 && (
                    <TabsTrigger value="POS">
                      <Monitor className="h-3.5 w-3.5" />
                      POS
                    </TabsTrigger>
                  )}
                  {(filteredMenu as any).HRM.length > 0 && (
                    <TabsTrigger value="HRM">
                      <Users className="h-3.5 w-3.5" />
                      HRM
                    </TabsTrigger>
                  )}
                  {(filteredMenu as any).ERP.length > 0 && (
                    <TabsTrigger value="ERP">
                      <Package className="h-3.5 w-3.5" />
                      ERP
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value={activeTab} className="flex-1 mt-0 min-h-0 overflow-hidden outline-none">
                <ScrollArea className="h-full" showShadows>
                  <div className="px-6 py-4 space-y-1">
                    {(filteredMenu as any)[activeTab].length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="p-4 rounded-full bg-secondary/50 mb-3">
                          <Search className="h-8 w-8 opacity-20" />
                        </div>
                        <p className="text-sm font-medium">No results found</p>
                        <p className="text-xs opacity-70">Check your permissions or active module</p>
                      </div>
                    ) : (
                      <div className="grid gap-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
                        {(filteredMenu as any)[activeTab].map((item: any) => (
                          <MasterMenuItem
                            key={item.title}
                            item={item}
                            pathname={pathname}
                            onNavigate={handleClick}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
