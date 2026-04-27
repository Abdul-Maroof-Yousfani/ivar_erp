"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useEnvironment } from "@/components/providers/environment-provider";

// Map route segments to display names
const routeNameMap: Record<string, string> = {
  department: "Department",
  "sub-department": "Sub Department",
  institute: "Institute",
  designation: "Designation",
  "job-type": "Job Type",
  "marital-status": "Marital Status",
  "employee-grade": "Employee Grade",
  "employee-status": "Employee Status",
  qualification: "Qualification",
  city: "City",
  branch: "Branch",
  equipment: "Equipment",
  "working-hours-policy": "Working Hours Policy",
  "leave-types": "Leave Types",
  "leaves-policy": "Leaves Policy",
  "loan-types": "Loan Types",
  "salary-breakup": "Salary Breakup",
  "tax-slabs": "Tax Slabs",
  "provident-fund": "Provident Fund",
  "bonus-types": "Bonus Types",
  "allowance-head": "Allowance Head",
  "deduction-head": "Deduction Head",
  banks: "Banks",
  "rebate-nature": "Rebate Nature",
  "social-security": "Social Security",
  eobi: "EOBI",
};

// Map actions to display names
const actionNameMap: Record<string, string> = {
  list: "List",
  add: "Add",
  edit: "Edit",
  view: "View",
  "manual-leaves": "Manual Leaves",
};

export function MasterTitleUpdater() {
  const pathname = usePathname();
  const { environment } = useEnvironment();
  const systemName = environment === "ERP" ? "ERP System" : "HR Management System";

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Extract route segments from pathname
    // Example: /master/department/list -> ['dashboard', 'master', 'department', 'list']
    const segments = pathname.split("/").filter(Boolean);
    
    // Find the index of 'master' in the segments
    const masterIndex = segments.indexOf("master");
    
    if (masterIndex === -1) {
      // Not in master section, use default
      document.title = `Master Data Management | ${systemName}`;
      return;
    }

    // Get the entity name (segment after 'master')
    const entitySegment = segments[masterIndex + 1];
    // Get the action (segment after entity, or default to 'list')
    const actionSegment = segments[masterIndex + 2] || "list";
    
    // Check if actionSegment is an ID (UUID format or numeric)
    const isId = actionSegment && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionSegment) || /^\d+$/.test(actionSegment);
    
    // If actionSegment is an ID, check if there's a view/edit action before it
    let actualAction = actionSegment;
    if (isId && segments[masterIndex + 3]) {
      actualAction = segments[masterIndex + 3];
    } else if (isId) {
      actualAction = "view";
    }

    // Get display names
    const entityName = routeNameMap[entitySegment] || 
      entitySegment?.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") || 
      "Master Data";
    
    const actionName = actionNameMap[actualAction] || 
      actualAction?.charAt(0).toUpperCase() + actualAction?.slice(1) || 
      "List";

    // Update document title
    document.title = `${entityName} ${actionName} | Master Data | ${systemName}`;
  }, [pathname, environment, systemName]);

  return null;
}

