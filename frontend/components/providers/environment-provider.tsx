"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { setEnvironmentCookie } from "@/app/actions/set-environment";

export type EnvironmentType = "HR" | "ERP" | "POS" | "ADMIN";

interface EnvironmentContextType {
  environment: EnvironmentType;
  /** @param targetPath Optional path to navigate to instead of the default env root */
  setEnvironment: (env: EnvironmentType, silent?: boolean, targetPath?: string) => void;
  toggleEnvironment: () => void;
  isLoading: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvironmentState] = useState<EnvironmentType>("HR");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Determine environment strictly from the URL first to avoid cookie crossover
    let envFromUrl: EnvironmentType | null = null;

    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;

      // Check subdomain strictly
      if (hostname.startsWith("erp.")) envFromUrl = "ERP";
      else if (hostname.startsWith("master.")) envFromUrl = null; // Do not overwrite on master domain, let cookies decide
      else if (hostname.startsWith("pos.")) envFromUrl = "POS";
      else if (hostname.startsWith("admin.")) envFromUrl = "ADMIN";
      else if (hostname.startsWith("hr.")) envFromUrl = "HR";

      // If subdomain didn't give it, check pathname
      if (!envFromUrl && !hostname.startsWith("master.")) {
        if (pathname.startsWith("/erp") || pathname.startsWith("/finance")) envFromUrl = "ERP";
        else if (pathname.startsWith("/pos")) envFromUrl = "POS";
        else if (pathname.startsWith("/admin") || pathname.startsWith("/activity-logs")) envFromUrl = "ADMIN";
        else if (pathname.startsWith("/hr") || pathname.startsWith("/dashboard")) envFromUrl = "HR";
      }
    }

    if (envFromUrl) {
      setEnvironmentState(envFromUrl);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.environment = envFromUrl;
      }
      // Set the cross-domain cookie explicitly so subdomains like 'master.' can read it later
      setEnvironmentCookie(envFromUrl).catch(console.error);
    } else {
      // Load saved environment from cookies
      const saved = Cookies.get("app-environment");

      if (saved === "ERP") {
        setEnvironmentState("ERP");
        if (typeof document !== "undefined") {
          document.documentElement.dataset.environment = "ERP";
        }
      } else if (saved === "POS") {
        setEnvironmentState("POS");
        if (typeof document !== "undefined") {
          document.documentElement.dataset.environment = "POS";
        }
      } else if (saved === "ADMIN") {
        setEnvironmentState("ADMIN");
        if (typeof document !== "undefined") {
          document.documentElement.dataset.environment = "ADMIN";
        }
      } else {
        // Default to HR
        setEnvironmentState("HR");
        if (typeof document !== "undefined") {
          document.documentElement.dataset.environment = "HR";
        }
      }
    }
    setIsLoading(false);
  }, []);

  const setEnvironment = async (env: EnvironmentType, silent: boolean = false, targetPath?: string) => {
    try {
      if (env === environment) {
        return;
      }

      setEnvironmentState(env);

      // Update DOM
      if (typeof document !== "undefined") {
        document.documentElement.dataset.environment = env;
      }

      // Use Server Action to set cookie (handles cross-subdomain logic via server headers)
      await setEnvironmentCookie(env);

      // Show feedback only if not silent
      if (!silent) {
        toast.success(`Switching to ${env} Environment...`, {
          duration: 2000,
        });
      }

      // Only navigate when user explicitly switches environment (not silent route-sync).
      // Silent calls come from dashboard-layout's route-sync effect on every page load —
      // those must NOT navigate or they cause a second full reload mid-auth-initialization.
      if (!silent && typeof window !== "undefined") {
        // Use caller-supplied targetPath if provided, otherwise fall back to env root.
        // This allows module-switcher to land on the first accessible route for partial-permission users.
        const defaultPath = env === "ERP" ? "/erp" : env === "ADMIN" ? "/admin" : env === "POS" ? "/pos" : "/hr";
        const path = targetPath ?? defaultPath;
        // Using window.location.href triggers a full page navigation allowing Next middleware
        // (middleware.ts) to correctly physically assign the user to the target subdomain.
        window.location.href = path;
      }
    } catch (error) {
      console.error("Failed to switch environment:", error);
      if (!silent) {
        toast.error("Failed to switch environment", {
          description: "An error occurred while saving your preference.",
        });
      }
    }
  };

  const toggleEnvironment = () => {
    const next = environment === "HR" ? "ERP" : environment === "ERP" ? "POS" : environment === "POS" ? "ADMIN" : "HR";
    setEnvironment(next);
  };

  return (
    <EnvironmentContext.Provider
      value={{
        environment,
        setEnvironment,
        toggleEnvironment,
        isLoading,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
}
