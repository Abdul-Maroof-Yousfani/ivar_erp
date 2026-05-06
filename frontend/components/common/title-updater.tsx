"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useEnvironment } from "@/components/providers/environment-provider";
import { menuData, MenuItem } from "@/components/dashboard/sidebar-menu-data";

// ---------------------------------------------------------------------------
// Universal Title Updater
// Derives page titles from menu data for any section (HR, ERP, POS, Master).
// ---------------------------------------------------------------------------

// Titles that are pure action/verb labels — never used as the entity name.
const ACTION_TITLES = new Set([
  "list",
  "add",
  "create",
  "edit",
  "view",
  "update",
  "delete",
  "manage",
  "report",
  "summary",
  "request",
  "transfer",
  "assign policy",
  "manual leaves",
  "bank report",
  "payslip",
  "payslips",
  "user accounts",
  "view requests",
  "view report",
  "view & reports",
  "create request",
  "issue bonus",
  "view pf",
  "create withdraw",
  "view withdraw",
  "view ledger",
  "view social security",
  "payslips emails",
]);

// Titles that are pure grouping wrappers — skip them when building the label.
// These are parent nodes that exist only to group children, not to name a page.
const GROUP_TITLES = new Set([
  "employee setup",
  "attendance setup",
  "leaves setup",
  "payroll setup",
  "request forwarding",
  "profile settings",
  "sales operations",
  "finance & accounts",
  "inventory",
  "procurement",
  "sales",
  "admin",
  "requisition & quotation",
  "orders & receiving",
  "landed cost",
  "transactions",
  "item setup",
  "warehouse wms",
  "reports",
  "kpi tracking",
  "task management",
  // POS groups
  "terminal",
]);

interface TitleMatch {
  /** Full breadcrumb from root → leaf */
  breadcrumb: string[];
  /** Match quality — higher is better */
  score: number;
}

/** Recursively walk the menu tree and collect every route that matches. */
function findMatches(
  items: MenuItem[],
  pathname: string,
  breadcrumb: string[] = [],
): TitleMatch[] {
  const results: TitleMatch[] = [];
  const cleanPath = pathname.split("?")[0];

  for (const item of items) {
    const crumb = [...breadcrumb, item.title];

    if (item.href) {
      const cleanHref = item.href.split("?")[0];

      if (cleanHref === cleanPath) {
        // Exact match — best possible
        results.push({ breadcrumb: crumb, score: 100 });
      } else if (cleanPath.startsWith(cleanHref + "/")) {
        // Current path is deeper than this href (parent match)
        const extra = cleanPath
          .slice(cleanHref.length)
          .split("/")
          .filter(Boolean).length;
        results.push({ breadcrumb: crumb, score: 60 - extra * 10 });
      }
    }

    if (item.children?.length) {
      results.push(...findMatches(item.children, pathname, crumb));
    }
  }

  return results;
}

/**
 * From a breadcrumb like:
 *   ["Employee Setup", "Employee", "List"]
 *   ["Payroll Setup", "Bonus", "Issue Bonus"]
 *   ["Attendance Setup", "Attendance", "Summary"]
 *
 * Produce a human title like:
 *   "Employee List"
 *   "Bonus Issue Bonus"  → simplified to "Bonus Issue"
 *   "Attendance Summary"
 */
function buildTitle(breadcrumb: string[]): string {
  // Filter out pure group wrappers
  const meaningful = breadcrumb.filter(
    (t) => !GROUP_TITLES.has(t.toLowerCase()),
  );

  if (meaningful.length === 0) return breadcrumb[breadcrumb.length - 1] ?? "";

  const last = meaningful[meaningful.length - 1];
  const lastLower = last.toLowerCase();
  const isAction = ACTION_TITLES.has(lastLower);

  if (meaningful.length === 1) {
    // Only one meaningful segment — use it as-is
    return last;
  }

  if (isAction) {
    // Combine entity (second-to-last meaningful) + action (last)
    const entity = meaningful[meaningful.length - 2];
    // Avoid redundancy like "Bonus Issue Bonus" → just "Bonus Issue"
    if (last.toLowerCase().startsWith(entity.toLowerCase())) {
      return last; // e.g. "Bonus Payslip" already contains context
    }
    return `${entity} ${last}`;
  }

  // Last segment is not a generic action — it's descriptive enough on its own
  return last;
}

/** Section label from the first URL segment */
function getSectionLabel(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  const map: Record<string, string> = {
    hr: "HR",
    erp: "ERP",
    pos: "POS",
    master: "Master Data",
    admin: "Admin",
  };
  return map[seg] ?? seg.toUpperCase();
}

// ---------------------------------------------------------------------------

interface TitleUpdaterProps {
  /** Override the section label shown after the page title */
  section?: string;
  /** Fallback page title when no menu match is found */
  fallback?: string;
}

export function TitleUpdater({ section, fallback }: TitleUpdaterProps = {}) {
  const pathname = usePathname();
  const { environment } = useEnvironment();

  const systemName = "System";

  const bestMatch = useMemo(() => {
    const matches = findMatches(menuData, pathname);
    if (!matches.length) return null;
    matches.sort((a, b) => b.score - a.score);
    return matches[0];
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const sectionLabel = section ?? getSectionLabel(pathname);

    let pageTitle: string;

    if (bestMatch) {
      pageTitle = buildTitle(bestMatch.breadcrumb);
    } else if (fallback) {
      pageTitle = fallback;
    } else {
      pageTitle = sectionLabel;
    }

    // Build final title: "Employee List | HR | HR Management System"
    const parts = [pageTitle];
    if (bestMatch && pageTitle !== sectionLabel) parts.push(sectionLabel);
    parts.push(systemName);

    document.title = parts.join(" | ");
  }, [pathname, environment, systemName, bestMatch, section, fallback]);

  return null;
}
