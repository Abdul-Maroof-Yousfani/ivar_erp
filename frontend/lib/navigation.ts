"use client";

// Helper function to build subdomain URLs
export function buildSubdomainUrl(subdomain: string, path: string): string {
  if (typeof window === "undefined") return path;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;

  // Detect if we're using localtest.me or localhost
  const isDevelopment = hostname.includes("localhost") || hostname.includes("127.0.0.1") || hostname.includes("localtest.me");

  if (isDevelopment) {
    let baseDomain = "localhost";
    if (hostname.includes("localtest.me")) {
      baseDomain = "localtest.me";
    }

    const portStr = port ? `:${port}` : "";
    return `${protocol}//${subdomain}.${baseDomain}${portStr}${path}`;
  } else {
    // Production: extract base domain
    const parts = hostname.split(".");
    let baseDomain = hostname;

    // List of known subdomains that we should replace if they are at the start of the hostname
    const knownSubdomains = ["hr", "admin", "auth", "master", "erp", "pos"];

    // If the first part of the hostname is a known subdomain, remove it to get the base domain
    if (parts.length > 1 && knownSubdomains.includes(parts[0])) {
      baseDomain = parts.slice(1).join(".");
    }

    return `${protocol}//${subdomain}.${baseDomain}${path}`;
  }
}

// Get current subdomain
export function getCurrentSubdomain(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;

  // Handle localhost subdomains
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    const parts = hostname.split(".");
    if (parts.length > 1 && parts[parts.length - 1] === "localhost") {
      return parts[0];
    }
    return null;
  }

  // Handle localtest.me subdomains
  if (hostname.includes("localtest.me")) {
    const parts = hostname.split(".");
    if (parts.length > 2 && parts[parts.length - 2] === "localtest" && parts[parts.length - 1] === "me") {
      return parts[0];
    }
    return null;
  }

  // Production subdomains
  const parts = hostname.split(".");
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}

// Determine target subdomain for a path
export function getTargetSubdomain(path: string): string {
  // Remove leading slash for comparison
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  // Check if path starts with known subdomain prefixes - these take priority
  if (cleanPath.startsWith("hr/")) {
    return "hr";
  }

  if (cleanPath.startsWith("admin/")) {
    return "admin";
  }

  if (cleanPath.startsWith("auth/")) {
    return "auth";
  }

  if (cleanPath.startsWith("master/")) {
    return "master";
  }

  if (cleanPath.startsWith("pos/")) {
    return "pos";
  }

  // HR-specific paths (without prefix)
  const hrPaths = [
    "attendance", "employee", "leaves", "payroll", "working-hours", "holidays",
    "payroll-setup", "loan-requests", "exit-clearance", "roles", "submenu",
    "settings", "salary-sheet", "request-forwarding"
  ];

  for (const hrPath of hrPaths) {
    if (cleanPath.startsWith(`${hrPath}/`) || cleanPath === hrPath) {
      return "hr";
    }
  }

  // Admin-specific paths (without prefix)
  if (cleanPath.startsWith("activity-logs") || cleanPath.startsWith("users")) {
    return "admin";
  }

  // Auth-specific paths (without prefix)
  if (cleanPath === "login" || cleanPath.startsWith("login/") || cleanPath === "pos-login" || cleanPath.startsWith("pos-login/")) {
    return "auth";
  }

  // Master data paths (without prefix)
  const masterPaths = [
    "department", "sub-department", "institute", "designation", "job-type",
    "marital-status", "employee-grade", "employee-status", "qualification",
    "city", "location", "allocation", "loan-types", "leave-types", "leaves-policy",
    "equipment", "salary-breakup", "eobi", "social-security", "tax-slabs",
    "tax-rate", "provident-fund", "bonus-types", "allowance-head", "deduction-head",
    "banks", "rebate-nature"
  ];

  for (const masterPath of masterPaths) {
    if (cleanPath.startsWith(`${masterPath}/`) || cleanPath === masterPath) {
      return "master";
    }
  }

  // POS-specific paths (without prefix)
  const posPaths = ["sales", "terminal", "inventory", "shifts"];
  for (const posPath of posPaths) {
    if (cleanPath.startsWith(`${posPath}/`) || cleanPath === posPath) {
      return "pos";
    }
  }

  // Default to hr for unknown paths
  return "hr";
}

// Strip subdomain prefix from path (e.g., /master/qualification/add -> /qualification/add)
function stripSubdomainPrefix(path: string, subdomain: string): string {
  const prefix = `/${subdomain}`;
  if (path.startsWith(prefix)) {
    const remaining = path.slice(prefix.length);
    return remaining || "/";
  }
  return path;
}

// Navigate to a path, handling cross-subdomain navigation
export function navigateToPath(path: string): void {
  const targetSubdomain = getTargetSubdomain(path);
  const currentSubdomain = getCurrentSubdomain();

  // If target subdomain is different from current, do full page navigation
  if (targetSubdomain !== currentSubdomain) {
    // Strip the subdomain prefix from the path before building the URL
    const cleanPath = stripSubdomainPrefix(path, targetSubdomain);
    const targetUrl = buildSubdomainUrl(targetSubdomain, cleanPath);
    window.location.href = targetUrl;
  } else {
    // Same subdomain - use window.location.href for reliable navigation
    // This ensures the navigation works correctly even if Next.js router has issues
    window.location.href = path;
  }
}

// Alternative navigation function that can be used with Next.js router
// This should be used in components that have access to useRouter hook
export function createNavigationHandler(router?: any) {
  return (path: string) => {
    const targetSubdomain = getTargetSubdomain(path);
    const currentSubdomain = getCurrentSubdomain();

    // If target subdomain is different from current, do full page navigation
    if (targetSubdomain !== currentSubdomain) {
      // Strip the subdomain prefix from the path before building the URL
      const cleanPath = stripSubdomainPrefix(path, targetSubdomain);
      const targetUrl = buildSubdomainUrl(targetSubdomain, cleanPath);
      window.location.href = targetUrl;
    } else {
      // Same subdomain - use Next.js router if available, otherwise fallback
      if (router && router.push) {
        router.push(path);
      } else {
        window.location.href = path;
      }
    }
  };
}
