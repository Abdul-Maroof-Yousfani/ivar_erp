"use client";

import { useEffect, useState } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { HeaderSearch } from "@/components/dashboard/header-search";
import { HeaderNotifications } from "@/components/dashboard/header-notifications";
import { HeaderUserMenu } from "@/components/dashboard/header-user-menu";
import { HeaderMasterMenu } from "@/components/dashboard/header-master-menu";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { ModuleSwitcher } from "@/components/dashboard/module-switcher";
import { SessionChecker } from "@/components/auth/session-checker";
import { useAuth } from "@/components/providers/auth-provider";
import { ImpersonationBanner } from "@/components/auth/impersonation-banner";
import { CompanyGuard } from "@/components/company/company-guard";
import { useEnvironment } from "@/components/providers/environment-provider";
import { Button } from "@/components/ui/button";
import { Search, X, Sparkles, AlertTriangle, ArrowRight, ShoppingCart, ShieldCheck, Monitor, Clock as ClockIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePathname, useRouter } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  companyOptional?: boolean;
}

export function DashboardLayout({ children, companyOptional = false }: DashboardLayoutProps) {
  const { user } = useAuth();
  const { environment, setEnvironment } = useEnvironment();
  const router = useRouter();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync environment with route
  useEffect(() => {
    if (pathname.startsWith("/erp") && environment !== "ERP") {
      setEnvironment("ERP", true);
    } else if (pathname.startsWith("/hr") && environment !== "HR") {
      setEnvironment("HR", true);
    } else if (pathname.startsWith("/pos") && environment !== "POS") {
      setEnvironment("POS", true);
    } else if (pathname.startsWith("/admin") && environment !== "ADMIN") {
      setEnvironment("ADMIN", true);
    }
  }, [pathname, setEnvironment]);

  const isImpersonating = !!user?.isImpersonating;
  const currentUserDisplayName = user ? `${user.firstName} ${user.lastName}` : undefined;

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (<>
    {/* Impersonation Banner — always shown on top when active */}
    {isImpersonating && <ImpersonationBanner employeeName={currentUserDisplayName} />}

    {/* First Password Banner - Full Screen Width */}
    {!isImpersonating && user?.isFirstPassword && (
      <div className="bg-orange-600 text-white text-center font-medium shrink-0 h-10 z-60 flex items-center justify-center gap-4 shadow-md border-b border-orange-700 fixed top-0 left-0 right-0">
        <AlertTriangle className="h-4 w-4 text-white animate-pulse" />
        <span className="text-xs tracking-wide">
          TEMPORARY PASSWORD DETECTED - PLEASE CHANGE YOUR PASSWORD
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="h-6 px-3 text-xs bg-white text-orange-600 hover:bg-orange-50 hover:text-orange-700 font-semibold border-0"
          onClick={() => router.push("/hr/settings/password")}
        >
          Change Now
        </Button>
      </div>
    )}
    <SidebarProvider className="flex-1">


      <SessionChecker />
      <AppSidebar />
      <SidebarInset>
        <header className="flex shrink-0 h-16 items-center gap-3 sm:gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 sm:px-6 sticky z-40 w-full justify-between shadow-sm" style={{
          top: "var(--banner-height)",
          viewTransitionName: "site-header",
        }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <SidebarTrigger className="shrink-0" />

            <div className="h-6 w-px bg-border/50 hidden md:block mx-1" />
            <ModuleSwitcher />

            <div className="h-4 w-px bg-border/40 hidden md:block mx-2" />

            {/* Real-time Clock */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-muted/50 transition-colors cursor-default">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex flex-col gap-0.5 min-w-[120px]">
                <span className="text-[10px] font-bold tracking-tight text-primary leading-none uppercase">
                  {formattedDate}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground leading-none">
                  {formattedTime}
                </span>
              </div>
            </div>

            {/* POS Terminal & Location Info */}
            {environment === "POS" && (
              <>
                <div className="h-4 w-px bg-border/40 hidden xl:block mx-1" />
                <div className="hidden xl:flex items-center gap-3 ml-1">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <Monitor className="h-3 w-3 text-indigo-500" />
                      <span className="text-[9px] font-black tracking-widest text-indigo-500 uppercase">Terminal</span>
                    </div>
                    <span className="text-[11px] font-bold text-foreground leading-none pl-4.5">
                      {user?.terminal?.name || user?.terminal?.code || "N/A"}
                    </span>
                  </div>

                  <div className="h-3 w-px bg-border/30" />

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      <span className="text-[9px] font-black tracking-widest text-emerald-500 uppercase">Location</span>
                    </div>
                    <span className="text-[11px] font-bold text-foreground leading-none pl-4.5">
                      {user?.terminal?.location?.name || user?.terminal?.location?.code || "N/A"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden shrink-0"
            onClick={() => setMobileSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop Search */}
            <div className="hidden sm:block flex-1 max-w-xs lg:max-w-sm ml-auto">
              <HeaderSearch />
            </div>
            <HeaderMasterMenu />
            <ThemeToggle />
            <HeaderNotifications />
            <HeaderUserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-[calc(var(--banner-height)+1rem)]! bg-muted/30">
          <CompanyGuard optional={companyOptional}>
            {children}
          </CompanyGuard>
        </main>
      </SidebarInset>

      {/* Mobile Floating Search */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50 sm:hidden"
              onClick={() => setMobileSearchOpen(false)}
            />
            {/* Floating Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-10 left-[10px] w-[calc(100%-20px)] z-51 sm:hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-background rounded-lg border shadow-lg p-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <HeaderSearch
                      onNavigate={() => setMobileSearchOpen(false)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 mt-0"
                    onClick={() => setMobileSearchOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </SidebarProvider></>
  );
}
