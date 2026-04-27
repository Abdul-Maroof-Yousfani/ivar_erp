"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
import { ChevronRight, ShieldCheck, Settings, LogOut, Building2 } from "lucide-react";
import {
  MenuItem,
  menuData,
  filterMenuByPermissions,
} from "./sidebar-menu-data";
import { cn } from "@/lib/utils";
import { getCurrentSubdomain } from "@/lib/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useEnvironment } from "@/components/providers/environment-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "../ui/button";

// Normalize path by stripping subdomain prefix for comparison
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
                src={"/image.png"}
                alt="Logo"
                width={30}
                height={30}
                className="object-contain"
              />
              </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden transition-opacity duration-200">
              <span className="font-bold text-base leading-tight text-sidebar-foreground">
                Speed Pvt. Limited
              </span>
              <span className="text-xs text-sidebar-foreground/60 font-medium">
                {logoLabel}
              </span>
            </div>
            <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center py-2">
              <div className="size-9 rounded-xl bg-primary/5 border border-primary/20 flex flex-col items-center justify-center shadow-xs">
                <span className="font-bold text-[8px] text-primary leading-none">DEMO</span>
                <span className="text-[6px] text-primary/60 font-medium">V1.0</span>
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 ">

        {/* <div className="group-data-[collapsible=icon]:hidden mt-2">
          {environment === "ADMIN" ? (
            <div className="flex flex-col gap-2 p-3 bg-linear-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <ShieldCheck className="w-12 h-12 rotate-12" />
              </div>

              <div className="flex items-center gap-2 text-primary relative z-10">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs tracking-wide leading-none">ADMIN PANEL</span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Super User Access</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEnvironment("HR");
                  router.push("/hr");
                }}
                className="w-full justify-start h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20 border border-transparent transition-colors mt-1 relative z-10"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" color="red" />
                Exit Admin Mode
              </Button>
            </div>
          ) : (
            <>
              {((hasHRAccess ? 1 : 0) + (hasERPAccess ? 1 : 0)) > 1 && (
                <Tabs
                  defaultValue={environment}
                  value={environment}
                  onValueChange={(v) => {
                    setEnvironment(v as any);
                    if (v === "HR") router.push("/hr");
                    if (v === "ERP") router.push("/erp");
                  }}
                  className="w-full"
                  variant="card"
                >
                  <TabsList className="grid w-full h-8 grid-cols-2">
                    {hasHRAccess && (
                      <TabsTrigger value="HR" className="text-xs">
                        HR
                      </TabsTrigger>
                    )}
                    {hasERPAccess && (
                      <TabsTrigger value="ERP" className="text-xs">
                        ERP
                      </TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              )}
            </>
          )}
        </div> */}

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
