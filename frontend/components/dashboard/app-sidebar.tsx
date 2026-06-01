"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, Search, Database, X } from "lucide-react";
import {
  MenuItem,
  menuData,
  masterMenuData,
  filterMenuByPermissions,
} from "./sidebar-menu-data";
import { cn } from "@/lib/utils";
import { getCurrentSubdomain } from "@/lib/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useEnvironment } from "@/components/providers/environment-provider";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

// ─── Flatten masterMenuData into navigable entries ────────────────────────────
interface MasterEntry {
  title: string;
  href: string;
  module?: "HR" | "ERP" | "POS";
}

function flattenMasterEntries(items: MenuItem[]): MasterEntry[] {
  const seen = new Set<string>();
  const entries: MasterEntry[] = [];
  for (const item of items) {
    let href: string | undefined;
    if (item.href) {
      href = item.href;
    } else if (item.children) {
      const viewChild =
        item.children.find((c) => c.title === "View" || c.title === "List") ??
        item.children[0];
      href = viewChild?.href;
    }
    if (href && !seen.has(href)) {
      seen.add(href);
      entries.push({ title: item.title, href, module: item.module });
    }
  }
  return entries.sort((a, b) => a.title.localeCompare(b.title));
}

// ─── Module badge config ──────────────────────────────────────────────────────
const MODULE_BADGE: Record<string, { label: string; className: string }> = {
  HR: { label: "HR", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  ERP: { label: "ERP", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  POS: { label: "POS", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

// ─── Master sidebar: inline search + flat list ────────────────────────────────
function MasterSidebarContent({
  accessibleItems,
  pathname,
}: {
  accessibleItems: MenuItem[];
  pathname: string;
}) {
  const { state } = useSidebar();
  const [search, setSearch] = React.useState("");
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const allEntries = React.useMemo(
    () => flattenMasterEntries(accessibleItems),
    [accessibleItems],
  );

  const filtered = React.useMemo(() => {
    if (!search.trim()) return allEntries;
    const q = search.trim().toLowerCase();
    return allEntries.filter((e) => e.title.toLowerCase().includes(q));
  }, [allEntries, search]);

  // ── Collapsed icon mode: show a search icon that opens a popover ──
  if (state === "collapsed") {
    return (
      <SidebarContent className="items-center pt-2">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-sidebar-accent transition-colors"
              title="Search master modules"
            >
              <Search className="h-4 w-4 text-sidebar-foreground/70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-64 p-0"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            <MasterSearchPanel
              entries={allEntries}
              onNavigate={() => setPopoverOpen(false)}
              inputRef={inputRef}
              pathname={pathname}
            />
          </PopoverContent>
        </Popover>
      </SidebarContent>
    );
  }

  // ── Expanded mode: inline search + scrollable flat list ──
  return (
    <SidebarContent className="px-0">
      {/* Search input */}
      <div className="px-3 pt-3 pb-2 border-b border-sidebar-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules..."
            className={cn(
              "w-full h-8 pl-8 pr-7 rounded-md text-xs bg-sidebar-accent/40 border border-sidebar-border/50",
              "placeholder:text-muted-foreground/60 text-sidebar-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring/40 focus:bg-sidebar-accent/60",
              "transition-colors",
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 px-0.5">
          {filtered.length} of {allEntries.length} modules
        </p>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1" showShadows>
        <div className="px-2 py-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Database className="h-6 w-6 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground/50">No modules found</p>
            </div>
          ) : (
            filtered.map((entry) => {
              const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  // @ts-ignore
                  transitionTypes={["nav-forward"]}
                  className={cn(
                    "flex items-center justify-between gap-2 w-full px-2.5 py-1.5 rounded-md text-xs",
                    "transition-colors duration-100 group",
                    isActive
                      ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <span className="truncate">{entry.title}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
    </SidebarContent>
  );
}

// ── Reusable search panel used in the collapsed popover ──
function MasterSearchPanel({
  entries,
  onNavigate,
  inputRef,
  pathname,
}: {
  entries: MasterEntry[];
  onNavigate: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  pathname: string;
}) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter((e) => e.title.toLowerCase().includes(q));
  }, [entries, search]);

  return (
    <div className="flex flex-col max-h-80">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules..."
            className="w-full h-8 pl-8 pr-3 rounded-md text-xs bg-muted/50 border border-border/50 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/40"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No modules found</p>
          ) : (
            filtered.map((entry) => {
              const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  // @ts-ignore
                  transitionTypes={["nav-forward"]}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors",
                    isActive
                      ? "bg-accent font-semibold"
                      : "hover:bg-accent/60",
                  )}
                >
                  <span className="truncate">{entry.title}</span>
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
function normalizePathForComparison(
  path: string,
  currentSubdomain: string | null,
): string {
  if (!path) return path;
  if (!currentSubdomain) return path;

  // Strip subdomain prefix if present (e.g., /hr/dashboard -> /dashboard)
  const prefix = `/${currentSubdomain}`;
  if (path.startsWith(prefix)) {
    const remaining = path.slice(prefix.length);
    return remaining || "/";
  }

  return path;
}

function SubMenuItem({ item, pathname }: { item: MenuItem; pathname: string }) {
  const currentSubdomain = getCurrentSubdomain();
  const normalizedPathname = normalizePathForComparison(
    pathname,
    currentSubdomain,
  );
  const normalizedHref = normalizePathForComparison(
    item.href || "",
    currentSubdomain,
  );
  const isActive = normalizedHref === normalizedPathname;

  if (item.children) {
    return (
      <Collapsible className="group/submenu w-full">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="cursor-pointer w-full flex items-center justify-between pr-2">
            <span className="truncate">{item.title}</span>
            <ChevronRight className="shrink-0 h-4 w-4 transition-transform group-data-[state=open]/submenu:rotate-90" />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-1.5 px-1">
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.title}>
                <SubMenuItem item={child} pathname={pathname} />
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuSubButton
      asChild
      isActive={isActive}
      className={cn(
        "transition-all duration-200 hover:bg-sidebar-accent/60",
        isActive && "bg-sidebar-accent/80 font-medium shadow-sm",
      )}
    >
      <Link href={item.href || "#"} transitionTypes={["nav-forward"]}
      >
        <span>{item.title}</span>
      </Link>
    </SidebarMenuSubButton>
  );
}

function MenuItemComponent({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const currentSubdomain = getCurrentSubdomain();
  const normalizedPathname = normalizePathForComparison(
    pathname,
    currentSubdomain,
  );
  const normalizedHref = normalizePathForComparison(
    item.href || "",
    currentSubdomain,
  );
  const isActive = normalizedHref === normalizedPathname;
  const { state } = useSidebar();

  // Hooks must be at the top level
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsPopoverOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsPopoverOpen(false);
    }, 150);
  };

  if (item.children) {
    // When sidebar is collapsed, show sub-menu in popover on hover
    if (state === "collapsed") {
      return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <SidebarMenuItem
            hasSubMenu={true}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <PopoverTrigger asChild>
              <SidebarMenuButton className="cursor-pointer w-full">
                {Icon && <Icon className="h-4 w-4" />}
                <span className="sr-only">{item.title}</span>
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              className="w-56 p-1"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="space-y-1">
                {item.children.map((child) => (
                  <SubMenuItemInPopover
                    key={child.title}
                    item={child}
                    pathname={pathname}
                  />
                ))}
              </div>
            </PopoverContent>
          </SidebarMenuItem>
        </Popover>
      );
    }

    // When sidebar is expanded, show normal collapsible menu
    return (
      <Collapsible className="group/collapsible">
        <SidebarMenuItem hasSubMenu={true}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/80 hover:shadow-sm">
              {Icon && (
                <Icon className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:scale-110" />
              )}
              <span>{item.title}</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden">
            <SidebarMenuSub className="mt-1 mx-2 px-1.5">
              {item.children.map((child) => (
                <SidebarMenuSubItem key={child.title}>
                  <SubMenuItem item={child} pathname={pathname} />
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "group relative transition-all duration-200",
          "hover:bg-sidebar-accent/80 hover:shadow-sm",
          isActive && "bg-sidebar-accent shadow-md font-semibold",
          "data-[active=true]:bg-sidebar-accent data-[active=true]:shadow-md",
        )}
      >
        <Link href={item.href || "#"} transitionTypes={["nav-forward"]}
        >
          {Icon && (
            <Icon
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isActive && "scale-110",
              )}
            />
          )}
          <span className="relative z-10">{item.title}</span>
          {isActive && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-3 rounded-r-full bg-primary transition-all duration-200 group-data-[state=collapsed]:hidden" />
          )}
          {isActive && (
            <div className="absolute right-[0.3rem] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-accent transition-all duration-200" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SubMenuItemInPopover({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const currentSubdomain = getCurrentSubdomain();
  const normalizedPathname = normalizePathForComparison(
    pathname,
    currentSubdomain,
  );
  const normalizedHref = normalizePathForComparison(
    item.href || "",
    currentSubdomain,
  );
  const isActive = normalizedHref === normalizedPathname;

  if (item.children) {
    const [isOpen, setIsOpen] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsOpen(true);
    };

    const handleMouseLeave = () => {
      timeoutRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 150);
    };

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={`
              w-full flex items-center justify-between rounded-sm px-2 py-1.5 text-sm
              hover:bg-accent hover:text-accent-foreground whitespace-nowrap
              ${isActive ? "bg-accent text-accent-foreground font-medium" : ""}
            `}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span className="whitespace-nowrap">{item.title}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          className="w-56 p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="space-y-1">
            {item.children.map((child) => (
              <SubMenuItemInPopover
                key={child.title}
                item={child}
                pathname={pathname}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Link
      href={item.href || "#"}
      transitionTypes={["nav-forward"]}
      className={`
        block w-full rounded-sm px-2 py-1.5 text-sm
        hover:bg-accent hover:text-accent-foreground
        ${isActive ? "bg-accent text-accent-foreground font-medium" : ""}
      `}
    >
      {item.title}
    </Link>
  );
}

export function AppSidebar({
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasAnyPermission, hasAllPermissions, isAdmin } = useAuth();
  const { environment, setEnvironment } = useEnvironment();

  const { filteredMenu, hasHRAccess, hasERPAccess } = React.useMemo(() => {
    // In MASTER environment, use masterMenuData and show all accessible items
    if (environment === "MASTER") {
      const permissionFiltered = filterMenuByPermissions(masterMenuData, {
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
      });
      return {
        filteredMenu: permissionFiltered,
        hasHRAccess: false,
        hasERPAccess: false,
      };
    }

    // First filter by permissions
    const permissionFiltered = filterMenuByPermissions(menuData, {
      hasAnyPermission,
      hasAllPermissions,
      isAdmin,
    });

    // Check which environments are accessible based on permissions (Strict check)
    // We only want to show the switcher if they have explicit access to specific HR and ERP modules
    // Items with "BOTH" (like Dashboard/Profile) shouldn't trigger the switcher presence
    const hasHRAccess = permissionFiltered.some(
      (item) => item.environment === "HR"
    );
    const hasERPAccess = permissionFiltered.some(
      (item) => item.environment === "ERP"
    );

    // Then filter by environment
    const envFiltered = permissionFiltered.filter((item) => {
      if (!item.environment || item.environment === "BOTH") return true;
      return item.environment === environment;
    });

    return { filteredMenu: envFiltered, hasHRAccess, hasERPAccess };
  }, [hasAnyPermission, hasAllPermissions, isAdmin, user, environment]);

  React.useEffect(() => {
    if (environment === "ADMIN") return;

    // Auto-switch environment if current one is not accessible
    if (environment === "HR" && !hasHRAccess && hasERPAccess) {
      setEnvironment("ERP");
      window.location.href = "/erp";
    } else if (environment === "ERP" && !hasERPAccess && hasHRAccess) {
      setEnvironment("HR");
      window.location.href = "/hr";
    }
  }, [hasHRAccess, hasERPAccess, environment, setEnvironment, router]);

  const logoLabel = React.useMemo(() => {
    if (environment === "ADMIN") return "Admin Panel";
    if (environment === "MASTER") return "Master Data";
    if (hasHRAccess && hasERPAccess) return "Dashboard";
    if (hasHRAccess) return "HR";
    if (hasERPAccess) return "ERP";
    return "Dashboard";
  }, [hasHRAccess, hasERPAccess, environment]);

  return (
    <Sidebar collapsible="icon" className="border-0 overflow-hidden">
      <SidebarRail />
      <SidebarHeader className="border-b border-sidebar-border/50 bg-linear-to-r from-sidebar to-sidebar-accent/30 px-4 py-3 backdrop-blur-sm shadow-sm">
        <div className="flex flex-col gap-3 group-data-[collapsible=icon]:gap-0">
          <div className="flex items-center gap-3 px-2 justify-center group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center justify-center size-10 aspect-square rounded-xl bg-white text-primary shadow-sm group-data-[collapsible=icon]:rounded-lg transition-all duration-200">
              <Image
                src={"/image-v2.png"}
                alt="Logo"
                width={30}
                height={30}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden transition-opacity duration-200">
              <span className="font-bold text-base leading-tight text-sidebar-foreground">
                IVAR
              </span>
              <span className="text-xs text-sidebar-foreground/60 font-medium">
                {logoLabel}
              </span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      {/* ── MASTER: inline search panel instead of a long menu tree ── */}
      {environment === "MASTER" ? (
        <MasterSidebarContent
          accessibleItems={filteredMenu}
          pathname={pathname}
        />
      ) : (
        <SidebarContent className="px-2">
          <ScrollArea className="-mx-2 px-2" showShadows>
            <SidebarGroup>
              <SidebarMenu className="space-y-1">
                {filteredMenu.map((item) => (
                  <MenuItemComponent
                    key={item.title}
                    item={item}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>
      )}

      <SidebarFooter className="border-t border-sidebar-border/50 px-4 py-3">
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden transition-opacity duration-200">
            <div className="flex items-center justify-center size-8 rounded-lg overflow-hidden bg-transparent">
              <Image
                src="/logo.png"
                alt="Speed (Pvt.) Limited Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-sidebar-foreground/60">
                Powered by
              </span>
              <span className="text-xs font-semibold text-sidebar-foreground truncate">
                {/* Speed (Pvt.) Limited */}
                Innovative Network
              </span>
            </div>
          </div>
          <div className="group-data-[collapsible=icon]:block hidden">
            <div className="flex items-center justify-center size-8 rounded-lg overflow-hidden bg-transparent">
              <Image
                src="/logo.png"
                alt="Speed (Pvt.) Limited Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
