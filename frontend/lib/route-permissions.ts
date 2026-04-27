// Route to permission mapping for HRM pages
// This ensures users can only access routes they have permissions for

export const routePermissions: Record<string, string[]> = {
  // Dashboard
  "/hr": ["hr.dashboard.view"],
  "/hr/my-dashboard": ["hr.dashboard.view"],

  // ERP - Finance & Accounts
  "/erp/finance/chart-of-accounts": ["erp.finance.chart-of-account.read"],
  "/erp/finance/chart-of-accounts/create": ["erp.finance.chart-of-account.create"],
  "/erp/finance/journal-voucher": ["erp.finance.journal-voucher.read"],
  "/erp/finance/journal-voucher/list": ["erp.finance.journal-voucher.read"],
  "/erp/finance/journal-voucher/create": ["erp.finance.journal-voucher.create"],
  "/erp/finance/payment-voucher": ["erp.finance.payment-voucher.read"],
  "/erp/finance/payment-voucher/list": ["erp.finance.payment-voucher.read"],
  "/erp/finance/payment-voucher/create": ["erp.finance.payment-voucher.create"],
  "/erp/finance/receipt-voucher": ["erp.finance.receipt-voucher.read"],
  "/erp/finance/receipt-voucher/list": ["erp.finance.receipt-voucher.read"],
  "/erp/finance/receipt-voucher/create": ["erp.finance.receipt-voucher.create"],
  "/erp/finance/reports": ["finance.reports.read"], // Assuming generic for now or specific if needed
  
  // Employee Setup
  "/hr/employee/create": ["hr.employee.create"],
  "/hr/employee/list": ["hr.employee.read"],
  "/hr/employee/view": ["hr.employee.read"],
  "/hr/employee/transfer": ["hr.employee.transfer"],
  "/hr/employee/edit": ["hr.employee.update"],
  "/hr/employee/user-account": ["hr.employee.user-account"],
  "/hr/employee/user-account/create": ["hr.employee.user-account"],
  
  // Exit Clearance
  "/hr/exit-clearance/create": ["hr.exit-clearance.create"],
  "/hr/exit-clearance/list": ["hr.exit-clearance.read"],
  "/hr/exit-clearance/edit": ["hr.exit-clearance.update"],
  
  // Attendance Setup
  "/hr/attendance/manage": ["hr.attendance.update"],
  "/hr/attendance/view": ["hr.attendance.view"],
  "/hr/attendance/summary": ["hr.attendance.summary"],
  "/hr/attendance/request": ["hr.attendance.request"],
  "/hr/attendance/request-list": ["hr.attendance.request-list"],
  "/hr/attendance/exemptions": ["hr.attendance.exemptions"],
  "/hr/attendance/exemptions-list": ["hr.attendance.exemptions-list"],
  
  // Working Hours
  "/hr/working-hours/create": ["hr.working-hour-policy.create"],
  "/hr/working-hours/view": ["hr.working-hour-policy.read"],
  "/hr/working-hours/assign-policy": ["hr.working-hour-policy.assign"],
  
  // Holidays
  "/hr/holidays/add": ["hr.holiday.create"],
  "/hr/holidays/list": ["hr.holiday.read"],
  
  // Leaves
  "/hr/leaves/create-leaves": ["hr.leave.create"],
  "/hr/leaves/requests": ["hr.leave.read"],
  
  // Payroll Setup
  "/hr/payroll-setup/payroll/create": ["hr.payroll.create"],
  "/hr/payroll-setup/payroll/report": ["hr.payroll.read"],
  "/hr/payroll-setup/payroll/bank-report": ["hr.payroll.read"],
  "/hr/payroll-setup/payroll/payslips": ["hr.payroll.read"],
  
  // Allowance
  "/hr/payroll-setup/allowance/create": ["hr.allowance.create"],
  "/hr/payroll-setup/allowance/view": ["hr.allowance.read"],
  "/hr/payroll-setup/allowance/bank-report": ["hr.allowance.read"],
  "/hr/payroll-setup/allowance/payslip": ["hr.allowance.read"],
  
  // Deduction
  "/hr/payroll-setup/deduction/create": ["hr.deduction.create"],
  "/hr/payroll-setup/deduction/view": ["hr.deduction.read"],
  
  // Advance Salary
  "/hr/payroll-setup/advance-salary/create": ["hr.advance-salary.create"],
  "/hr/payroll-setup/advance-salary/view": ["hr.advance-salary.read"],
  
  // Loan Requests
  "/hr/loan-requests/create": ["hr.loan-request.create"],
  "/hr/loan-requests/view": ["hr.loan-request.read"],
  
  // Increment
  "/hr/payroll-setup/increment/create": ["hr.increment.create"],
  "/hr/payroll-setup/increment/view": ["hr.increment.read"],
  
  // Bonus
  "/hr/payroll-setup/bonus/issue": ["hr.bonus.create"],
  "/hr/payroll-setup/bonus/view": ["hr.bonus.read"],
  "/hr/payroll-setup/bonus/bank-report": ["hr.bonus.read"],
  "/hr/payroll-setup/bonus/payslip": ["hr.bonus.read"],
  
  // Leave Encashment
  "/hr/payroll-setup/leave-encashment/create": ["hr.leave-encashment.create"],
  "/hr/payroll-setup/leave-encashment/list": ["hr.leave-encashment.read"],
  
  // PF for Employee
  "/hr/payroll-setup/pf-employee/view": ["hr.provident-fund.read"],
  "/hr/payroll-setup/pf-employee/withdraw-create": ["hr.provident-fund.create"],
  "/hr/payroll-setup/pf-employee/withdraw-view": ["hr.provident-fund.read"],
  "/hr/payroll-setup/pf-employee/report": ["hr.provident-fund.read"],
  "/hr/payroll-setup/pf-employee/ledger": ["hr.provident-fund.read"],
  
  // Rebate
  "/hr/payroll-setup/rebate/create": ["hr.rebate.create"],
  "/hr/payroll-setup/rebate/list": ["hr.rebate.read"],
  "/hr/payroll-setup/rebate-nature": ["hr.rebate-nature.read"],
  
  // Final Settlement
  "/hr/payroll-setup/final-settlement/create": ["hr.payroll.create"],
  "/hr/payroll-setup/final-settlement/list": ["hr.payroll.read"],
  
  // Salary Sheet & Social Security
  "/hr/salary-sheet/tax-certificate": ["hr.salary-sheet.read"],
  "/hr/payroll-setup/social-security-employee/view": ["hr.social-security.read"],
  
  // Request Forwarding
  "/hr/request-forwarding": ["hr.request-forwarding.view"],
  
  // Master - ERP


  "/master/category": ["master.category.read"],
  "/master/category/add": ["master.category.create"],
  "/master/category/list": ["master.category.read"],
  "/master/sub-category": ["master.sub-category.read"],
  "/master/sub-category/add": ["master.sub-category.create"],
  "/master/sub-category/list": ["master.sub-category.read"],
  "/master/unit-of-measurement/add": ["master.uom.create"],
  "/master/unit-of-measurement/list": ["master.uom.read"],
  "/master/tax-rate/add": ["master.tax-rate.create"],
  "/master/tax-rate/list": ["master.tax-rate.read"],
  "/master/brand": ["master.brand.read"],
  "/master/brand/add": ["master.brand.create"],
  "/master/brand/list": ["master.brand.read"],
  "/master/channel-class": ["master.channel-class.read"],
  "/master/channel-class/add": ["master.channel-class.create"],
  "/master/channel-class/list": ["master.channel-class.read"],
  "/master/color": ["master.color.read"],
  "/master/color/add": ["master.color.create"],
  "/master/color/list": ["master.color.read"],
  "/master/gender": ["master.gender.read"],
  "/master/gender/add": ["master.gender.create"],
  "/master/gender/list": ["master.gender.read"],
  "/master/size": ["master.size.read"],
  "/master/size/add": ["master.size.create"],
  "/master/size/list": ["master.size.read"],
  "/master/silhouette": ["master.silhouette.read"],
  "/master/silhouette/add": ["master.silhouette.create"],
  "/master/silhouette/list": ["master.silhouette.read"],
  "/master/segment": ["master.segment.read"],
  "/master/segment/add": ["master.segment.create"],
  "/master/segment/list": ["master.segment.read"],
  "/master/item-class": ["master.item-class.read"],
  "/master/item-class/add": ["master.item-class.create"],
  "/master/item-class/list": ["master.item-class.read"],
  "/master/item-subclass": ["master.item-subclass.read"],
  "/master/item-subclass/add": ["master.item-subclass.create"],
  "/master/item-subclass/list": ["master.item-subclass.read"],
  "/master/hs-code": ["master.hs-code.read"],
  "/master/hs-code/add": ["master.hs-code.create"],
  "/master/hs-code/list": ["master.hs-code.read"],
  "/master/season": ["master.season.read"],
  "/master/season/add": ["master.season.create"],
  "/master/season/list": ["master.season.read"],
  "/master/old-season": ["master.old-season.read"],
  "/master/old-season/add": ["master.old-season.create"],
  "/master/old-season/list": ["master.old-season.read"],
  "/master/pos-config": ["master.promo.read", "master.coupon.read", "master.alliance.read"],


  // KPI Tracking
  "/hr/kpi/dashboard": ["hr.kpi.read"],
  "/hr/kpi/templates": ["hr.kpi.read"],
  "/hr/kpi/reviews": ["hr.kpi.read"],
  "/hr/kpi/employee": ["hr.kpi.read"],
  "/hr/kpi/approvals": ["hr.kpi.approve"],

  // Task Assessment
  "/hr/tasks/projects": ["task.project.read"],
  "/hr/tasks/projects/create": ["task.project.create"],
  "/hr/tasks/my-tasks": ["task.read"],

  // Settings - public (all authenticated users)
  "/hr/settings/password": [],
  "/hr/settings/profile": [],
};

// Default permissions for routes that don't have explicit mapping
// If a route is not in the mapping above, it will require these permissions
// Set to empty array [] to allow all authenticated users, or specify permissions to restrict
const DEFAULT_ROUTE_PERMISSIONS: string[] = [];

/**
 * Check if route should be accessible without explicit permissions
 */
export function isPublicRoute(pathname: string): boolean {
  // Dashboard and settings are always public
  if (pathname === "/hr" || pathname.startsWith("/hr/settings")) {
    return true;
  }
  
  // If route has explicit empty permissions, it's public
  const permissions = getRoutePermissions(pathname);
  return permissions.length === 0 && routePermissions[pathname] !== undefined;
}

/**
 * Get required permissions for a route
 */
export function getRoutePermissions(pathname: string): string[] {
  // Normalize pathname (remove trailing slash, handle query params)
  const normalizedPath = pathname.split('?')[0].replace(/\/$/, '') || pathname;
  
  // Check exact match first
  if (routePermissions[normalizedPath]) {
    return routePermissions[normalizedPath];
  }
  
  // Check prefix matches (for dynamic routes like /hr/employee/view/[id])
  // Sort by length (longest first) to match most specific routes first
  const sortedRoutes = Object.entries(routePermissions).sort((a, b) => b[0].length - a[0].length);
  
  for (const [route, permissions] of sortedRoutes) {
    if (normalizedPath.startsWith(route)) {
      return permissions;
    }
  }
  
  // If route is not in mapping, check if it's a known HR route
  // For unknown routes, require at least some HR permission to prevent unauthorized access
  if (normalizedPath.startsWith("/hr/")) {
    // Return default permissions for unknown HR routes
    // This ensures users can't access routes that aren't explicitly allowed
    return DEFAULT_ROUTE_PERMISSIONS.length > 0 ? DEFAULT_ROUTE_PERMISSIONS : ["hr.employee.read"];
  }
  
  // Default: no permissions required (public route)
  return [];
}

/**
 * Check if a route requires permissions
 */
export function routeRequiresPermissions(pathname: string): boolean {
  const permissions = getRoutePermissions(pathname);
  return permissions.length > 0;
}

