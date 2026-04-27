import {
  LayoutDashboard,
  Users,
  LogOut,
  Clock,
  Palmtree,
  Wallet,
  Gift,
  Timer,
  Coins,
  PiggyBank,
  FileText,
  Receipt,
  Settings,
  Shield,
  Menu,
  Database,
  Landmark,
  Package,
  ShoppingCart,
  TrendingUp,
  Monitor,
  CheckSquare,
} from "lucide-react";

export type MenuItem = {
  title: string;
  icon?: React.ElementType;
  href?: string;
  children?: MenuItem[];
  permissions?: string[];
  requireAllPermissions?: boolean;
  environment?: "HR" | "ERP" | "BOTH" | "ADMIN" | "POS";
};

export const masterMenuData: MenuItem[] = [
  {
    title: "Brand",
    environment: "ERP",
    permissions: ["master.brand.read", "master.brand.create"],
    children: [
      { title: "Add", href: "/master/brand/add" },
      { title: "View", href: "/master/brand/list" },
    ],
  },
  {
    title: "Division",
    environment: "ERP",
    permissions: ["master.division.read", "master.division.create"],
    children: [
      { title: "Add", href: "/master/division/add" },
      { title: "View", href: "/master/division/list" },
    ],
  },
  {
    title: "Gender",
    environment: "ERP",
    permissions: ["master.gender.read", "master.gender.create"],
    children: [
      { title: "Add", href: "/master/gender/add" },
      { title: "View", href: "/master/gender/list" },
    ],
  },
  {
    title: "Size",
    environment: "ERP",
    permissions: ["master.size.read", "master.size.create"],
    children: [
      { title: "Add", href: "/master/size/add" },
      { title: "View", href: "/master/size/list" },
    ],
  },
  {
    title: "Silhouette",
    environment: "ERP",
    permissions: ["master.silhouette.read", "master.silhouette.create"],
    children: [
      { title: "Add", href: "/master/silhouette/add" },
      { title: "View", href: "/master/silhouette/list" },
    ],
  },
  {
    title: "Segment",
    environment: "ERP",
    permissions: ["master.segment.read", "master.segment.create"],
    children: [
      { title: "Add", href: "/master/segment/add" },
      { title: "View", href: "/master/segment/list" },
    ],
  },
  {
    title: "Item Class",
    environment: "ERP",
    permissions: ["master.item-class.read", "master.item-class.create"],
    children: [
      { title: "Add", href: "/master/class/add" },
      { title: "View", href: "/master/class/list" },
    ],
  },
  {
    title: "Item Subclass",
    environment: "ERP",
    permissions: ["master.item-subclass.read", "master.item-subclass.create"],
    children: [
      { title: "Add", href: "/master/subclass/add" },
      { title: "View", href: "/master/subclass/list" },
    ],
  },
  {
    title: "HS Code",
    environment: "ERP",
    permissions: ["master.hs-code.read", "master.hs-code.create"],
   
    children: [
      { title: "Add", href: "/master/hs-code/add" },
      { title: "View", href: "/master/hs-code/list" },
    ],
  },
  {

    title: "Season",
    environment: "ERP",
    permissions: ["master.season.read", "master.season.create"],
    children: [
      { title: "Add", href: "/master/season/add" },
      { title: "View", href: "/master/season/list" },
    ],
  },
  {

    title: "Old Season",
    environment: "ERP",
    permissions: ["master.old-season.read", "master.old-season.create"],
     children: [
      { title: "Add", href: "/master/old-season/add" },
      { title: "View", href: "/master/old-season/list" },
    ],
  },
  {

    title: "Channel Class",
    environment: "ERP",
    permissions: ["master.channel-class.read", "master.channel-class.create"],
    children: [
      { title: "Add", href: "/master/channel-class/add" },
      { title: "View", href: "/master/channel-class/list" },
    ],
  },
  {
    title: "Color",
    environment: "ERP",
    permissions: ["master.color.read", "master.color.create"],
    children: [
      { title: "Add", href: "/master/color/add" },
      { title: "View", href: "/master/color/list" },
    ],
  },
  {
    title: "Department",
    environment: "HR",
    permissions: ["master.department.read", "master.department.create"],
    children: [
      { title: "Add", href: "/master/department/add" },
      { title: "View", href: "/master/department/list" },
    ],
  },
  {
    title: "Sub Department",
    environment: "HR",
    permissions: ["master.sub-department.read", "master.sub-department.create"],
    children: [
      { title: "Add", href: "/master/sub-department/add" },
      { title: "View", href: "/master/sub-department/list" },
    ],
  },
  {
    title: "Institute",
    environment: "HR",
    permissions: ["master.institute.read", "master.institute.create"],
    children: [
      { title: "Add", href: "/master/institute/add" },
      { title: "View", href: "/master/institute/list" },
    ],
  },
  {
    title: "Designation",
    environment: "HR",
    permissions: ["master.designation.read", "master.designation.create"],
    children: [
      { title: "Add", href: "/master/designation/add" },
      { title: "View", href: "/master/designation/list" },
    ],
  },
  {
    title: "Job Type",
    environment: "HR",
    permissions: ["master.job-type.read", "master.job-type.create"],
    children: [
      { title: "Add", href: "/master/job-type/add" },
      { title: "View", href: "/master/job-type/list" },
    ],
  },
  {
    title: "Marital Status",
    environment: "HR",
    permissions: ["master.marital-status.read", "master.marital-status.create"],
    children: [
      { title: "Add", href: "/master/marital-status/add" },
      { title: "View", href: "/master/marital-status/list" },
    ],
  },
  {
    title: "Employee Grade",
    environment: "HR",
    permissions: ["master.employee-grade.read", "master.employee-grade.create"],
    children: [
      { title: "Add", href: "/master/employee-grade/add" },
      { title: "View", href: "/master/employee-grade/list" },
    ],
  },
  {
    title: "Employement Status",
    environment: "HR",
    permissions: [
      "master.employee-status.read",
      "master.employee-status.create",
    ],
    children: [
      { title: "Add", href: "/master/employee-status/add" },
      { title: "View", href: "/master/employee-status/list" },
    ],
  },
  {
    title: "Qualification",
    environment: "HR",
    permissions: ["master.qualification.read", "master.qualification.create"],
    children: [
      { title: "Add", href: "/master/qualification/add" },
      { title: "View", href: "/master/qualification/list" },
    ],
  },
  {
    title: "City",
    environment: "HR",
    permissions: ["master.city.read", "master.city.create"],
    children: [
      { title: "Add", href: "/master/city/add" },
      { title: "View", href: "/master/city/list" },
    ],
  },
  {
    title: "Location",
    environment: "HR",
    permissions: ["master.location.read", "master.location.create"],
    children: [
      { title: "Add", href: "/master/location/add" },
      { title: "View", href: "/master/location/list" },
    ],
  },
  // {
  //   title: "POS Config",
  //   environment: "HR",
  //   permissions: ["master.location.read"],
  //   children: [
  //     { title: "Manage", href: "/master/pos-config" },
  //   ],
  // },
  {
    title: "Region",
    environment: "HR",
    permissions: ["master.region.read", "master.region.create"],
    children: [
      { title: "Add", href: "/master/region/add" },
      { title: "View", href: "/master/region/list" },
    ],
  },
  {
    title: "Contact",
    environment: "HR",
    permissions: ["master.contact.read", "master.contact.create"],
    children: [
      { title: "Add", href: "/master/contact/add" },
      { title: "View", href: "/master/contact/list" },
    ],
  },
  {
    title: "Allocation",
    environment: "HR",
    permissions: ["master.allocation.read", "master.allocation.create"],
    children: [
      { title: "Add", href: "/master/allocation/add" },
      { title: "View", href: "/master/allocation/list" },
    ],
  },
  {
    title: "Loan Types",
    environment: "HR",
    permissions: ["master.loan-type.read", "master.loan-type.create"],
    children: [
      { title: "Add", href: "/master/loan-types/add" },
      { title: "View", href: "/master/loan-types/list" },
    ],
  },
  {
    title: "Leave Types",
    environment: "HR",
    permissions: ["master.leave-type.read", "master.leave-type.create"],
    children: [
      { title: "Add", href: "/master/leave-types/add" },
      { title: "View", href: "/master/leave-types/list" },
    ],
  },
  {
    title: "Leaves Policy",
    environment: "HR",
    permissions: ["master.leaves-policy.read", "master.leaves-policy.create"],
    children: [
      { title: "Add", href: "/master/leaves-policy/add" },
      { title: "View", href: "/master/leaves-policy/list" },
      {
        title: "Add Manual Leaves",
        href: "/master/leaves-policy/manual-leaves",
      },
    ],
  },
  {
    title: "Equipment",
    environment: "HR",
    permissions: ["master.equipment.read", "master.equipment.create"],
    children: [
      { title: "Add", href: "/master/equipment/add" },
      { title: "View", href: "/master/equipment/list" },
    ],
  },
  {
    title: "Salary Breakup",
    environment: "HR",
    permissions: ["master.salary-breakup.read", "master.salary-breakup.create"],
    children: [
      { title: "Add", href: "/master/salary-breakup/add" },
      { title: "View", href: "/master/salary-breakup/list" },
    ],
  },
  {
    title: "EOBI",
    environment: "HR",
    permissions: ["master.eobi.read", "master.eobi.create"],
    children: [
      { title: "Add", href: "/master/eobi/add" },
      { title: "View", href: "/master/eobi/list" },
    ],
  },
  {
    title: "Social Security",
    environment: "HR",
    permissions: [
      "master.social-security.read",
      "master.social-security.create",
    ],
    children: [
      { title: "Add", href: "/master/social-security/add" },
      { title: "View", href: "/master/social-security/list" },
    ],
  },
  {
    title: "Tax Slabs",
    environment: "HR",
    permissions: ["master.tax-slab.read", "master.tax-slab.create"],
    children: [
      { title: "Add", href: "/master/tax-slabs/add" },
      { title: "View", href: "/master/tax-slabs/list" },
    ],
  },
  {
    title: "Provident Fund",
    environment: "HR",
    permissions: ["master.provident-fund.read", "master.provident-fund.create"],
    children: [
      { title: "Add", href: "/master/provident-fund/add" },
      { title: "View", href: "/master/provident-fund/list" },
    ],
  },
  {
    title: "Bonus Types",
    environment: "HR",
    permissions: ["master.bonus-type.read", "master.bonus-type.create"],
    children: [
      { title: "Add", href: "/master/bonus-types/add" },
      { title: "View", href: "/master/bonus-types/list" },
    ],
  },
  {
    title: "Allowance",
    environment: "HR",
    permissions: ["master.allowance-head.read", "master.allowance-head.create"],
    children: [
      { title: "Add", href: "/master/allowance-head/add" },
      { title: "View", href: "/master/allowance-head/list" },
    ],
  },
  {
    title: "Deduction",
    environment: "HR",
    permissions: ["master.deduction-head.read", "master.deduction-head.create"],
    children: [
      { title: "Add", href: "/master/deduction-head/add" },
      { title: "View", href: "/master/deduction-head/list" },
    ],
  },
  {
    title: "Bank",
    environment: "HR",
    permissions: ["master.bank.read", "master.bank.create"],
    children: [
      { title: "Add", href: "/master/banks/add" },
      { title: "View", href: "/master/banks/list" },
    ],
  },
  {
    title: "Purchase Pool",
    environment: "ERP",
    permissions: ["master.purchase-pool.read", "master.purchase-pool.create"],
    children: [
      { title: "Add", href: "/master/purchase-pool/add" },
      { title: "View", href: "/master/purchase-pool/list" },
    ],
  },
  // {
  //   title: "Supplier",
  //   environment: "ERP",
  //   permissions: ["master.supplier.read", "master.supplier.create"],
  //   children: [
  //     { title: "Add", href: "/master/supplier/add" },
  //     { title: "View", href: "/master/supplier/list" },
  //   ],
  // },
  {
    title: "Category",
    environment: "ERP",
    permissions: ["master.category.read", "master.category.create"],
    children: [
      { title: "Add", href: "/master/category/add" },
      { title: "View", href: "/master/category/list" },
    ],
  },
  {
    title: "Sub Category",
    environment: "ERP",
    permissions: ["master.sub-category.read", "master.sub-category.create"],
    children: [
      { title: "Add", href: "/master/sub-category/add" },
      { title: "View", href: "/master/sub-category/list" },
    ],
  },
  {
    title: "Sub Item",
    environment: "ERP",
    permissions: ["master.sub-item.read", "master.sub-item.create"],
    children: [
      { title: "Add", href: "/master/sub-item/add" },
      { title: "View", href: "/master/sub-item/list" },
    ],
  },
  {

    title: "Unit Of Measurment",
    environment: "ERP",
    permissions: [
      "master.unit-of-measurement.read",
      "master.unit-of-measurement.create",
    ],
    children: [
      { title: "Add", href: "/master/unit-of-measurement/add" },
      { title: "View", href: "/master/unit-of-measurement/list" },
    ],
  },
  {
    title: "Tax Rate 1",
    environment: "ERP",
    permissions: ["master.tax-rate.read", "master.tax-rate.create"],
    children: [
      { title: "Add", href: "/master/tax-rate/add" },
      { title: "View", href: "/master/tax-rate/list" },
    ],
  },
  {
    title: "Demand Type",
    environment: "ERP",
    permissions: ["master.demand-type.read", "master.demand-type.create"],
    children: [
      { title: "Add", href: "/master/demand-type/add" },
      { title: "View", href: "/master/demand-type/list" },
    ],
  },
  {
    title: "Warehouse",
    environment: "ERP",
    permissions: ["master.warehouse.read", "master.warehouse.create"],
    children: [
      { title: "Add", href: "/master/warehouse/add" },
      { title: "View", href: "/master/warehouse/list" },
    ],
  },
  {
    title: "Salesman",
    environment: "ERP",
    permissions: ["master.salesman.read", "master.salesman.create"],
    children: [
      { title: "Add", href: "/master/salesman/add" },
      { title: "View", href: "/master/salesman/list" },
    ],
  },
  {
    title: "Cluster",
    environment: "ERP",
    permissions: ["master.cluster.read", "master.cluster.create"],
    children: [
      { title: "Add", href: "/master/cluster/add" },
      { title: "View", href: "/master/cluster/list" },
    ],
  },
  {
    title: "Opening Inventory",
    environment: "ERP",
    permissions: [
      "master.opening-inventory.read",
      "master.opening-inventory.create",
    ],
    children: [
      { title: "Add", href: "/master/opening-inventory/add" },
      { title: "View", href: "/master/opening-inventory/list" },
    ],
  },
  {
    title: "Vendor Opening",
    environment: "ERP",
    permissions: ["master.vendor-opening.read", "master.vendor-opening.create"],
    children: [
      { title: "Add", href: "/master/vendor-opening/add" },
      { title: "View", href: "/master/vendor-opening/list" },
    ],
  },
  {
    title: "Tax Rate 1",
    environment: "ERP",
    permissions: ["master.tax-rate.read", "master.tax-rate.create"],
    children: [
      { title: "Add", href: "/master/tax-rate/add" },
      { title: "View", href: "/master/tax-rate/list" },
    ],
  },
  // {
  //   title: "Warehouse",
  //   environment: "ERP",
  //   permissions: ["master.warehouse.read", "master.warehouse.create"],
  //   children: [
  //     { title: "Add", href: "/master/warehouse/add" },
  //     { title: "View", href: "/master/warehouse/list" },
  //   ],
  // },


  {
    title: "Manage Outlets",
    href: "/master/location/list",
    permissions: ["master.location.read"],
    environment: "POS",
  },
  {
    title: "Terminal List",
    href: "/master/pos/list",
    permissions: ["master.pos.read"],
    environment: "POS",
  },
  {
    title: "POS Config",
    environment: "POS",
    permissions: ["master.promo.read", "master.coupon.read", "master.alliance.read"],
    children: [
      { title: "Promos", href: "/master/pos-config?tab=promos", permissions: ["master.promo.read"] },
      { title: "Coupons", href: "/master/pos-config?tab=coupons", permissions: ["master.coupon.read"] },
      { title: "Alliances", href: "/master/pos-config?tab=alliances", permissions: ["master.alliance.read"] },
    ]
  },

];

export const menuData: MenuItem[] = [
  {
    title: "HRM Dashboard",
    icon: LayoutDashboard,
    href: "/hr",
    environment: "HR",
    permissions: ["hr.dashboard.view"],
  },
  {
    title: "ERP Dashboard",
    icon: LayoutDashboard,
    href: "/erp",
    environment: "ERP",
    permissions: ["erp.item.read", "erp.finance.chart-of-account.read", "erp.finance.journal-voucher.read", "inventory.read", "procurement.read"],
  },
  {
    title: "POS Dashboard",
    icon: LayoutDashboard,
    href: "/pos",
    environment: "POS",
    permissions: ["pos.dashboard.view"],
  },
  {
    title: "Finance & Accounts",
    icon: Landmark,
    environment: "ERP",
    permissions: [
      "erp.finance.chart-of-account.read",
      "erp.finance.journal-voucher.read",
      "erp.finance.payment-voucher.read",
      "erp.finance.receipt-voucher.read",
    ],
    children: [
      {
        title: "Chart of Accounts",
        permissions: ["erp.finance.chart-of-account.read"],
        children: [
          {
            title: "Create",
            href: "/erp/finance/chart-of-accounts/create",
            permissions: ["erp.finance.chart-of-account.create"],
          },
          {
            title: "List",
            href: "/erp/finance/chart-of-accounts",
            permissions: ["erp.finance.chart-of-account.read"],
          },
        ],
      },
      {
        title: "Opening Balance",
        href: "/erp/finance/opening-balance",
        permissions: ["erp.finance.chart-of-account.update"],
      },
      {
        title: "Journal Voucher",
        permissions: ["erp.finance.journal-voucher.read"],
        children: [
          {
            title: "Create",
            href: "/erp/finance/journal-voucher/create",
            permissions: ["erp.finance.journal-voucher.create"],
          },
          {
            title: "List",
            href: "/erp/finance/journal-voucher/list",
            permissions: ["erp.finance.journal-voucher.read"],
          },
        ],
      },
      {
        title: "Payment Voucher",
        permissions: ["erp.finance.payment-voucher.read"],
        children: [
          {
            title: "Create",
            href: "/erp/finance/payment-voucher/create",
            permissions: ["erp.finance.payment-voucher.create"],
          },
          {
            title: "List",
            href: "/erp/finance/payment-voucher/list",
            permissions: ["erp.finance.payment-voucher.read"],
          },
        ],
      },
      {
        title: "Receipt Voucher",
        permissions: ["erp.finance.receipt-voucher.read"],
        children: [
          {
            title: "Create",
            href: "/erp/finance/receipt-voucher/create",
            permissions: ["erp.finance.receipt-voucher.create"],
          },
          {
            title: "List",
            href: "/erp/finance/receipt-voucher/list",
            permissions: ["erp.finance.receipt-voucher.read"],
          },
        ],
      },
      {
        title: "Reports",
        children: [
          {
            title: "General Ledger",
            href: "/erp/finance/reports/general-ledger",
          },
          {
            title: "Trial Balance (6-Col)",
            href: "/erp/finance/reports/trial-balance",
          },
          {
            title: "Trial Balance (5-Col)",
            href: "/erp/finance/reports/trial-balance-5col",
          },
          {
            title: "Balance Sheet",
            href: "/erp/finance/reports/balance-sheet",
          },
          { title: "Profit & Loss", href: "/erp/finance/reports/profit-loss" },
        ],
      },
    ],
  },
  {
    title: "Inventory",
    icon: Package,
    environment: "ERP",
    permissions: ["inventory.read", "erp.item.read", "erp.item.create"],
    children: [
      { title: "Dashboard", href: "/erp/inventory" },
      {
        title: "Warehouse WMS",
        children: [
          { title: "Dashboard", href: "/erp/inventory/warehouse" },
          { title: "Warehouse", href: "/erp/inventory/warehouse/add" },
          { title: "Inventory Explorer", href: "/erp/inventory/explorer" },
          {
            title: "Inventory List",
            href: "/erp/inventory/warehouse/inventory",
          },
        ],
      },
      {
        title: "Item Setup",
        permissions: ["erp.item.read", "erp.item.create"],
        children: [
          { title: "Create", href: "/erp/items/create", permissions: ["erp.item.create"] },
          { title: "List", href: "/erp/items/list", permissions: ["erp.item.read"] },
          // { title: "Categories", href: "/erp/inventory/categories" },
        ],
      },
      {
        title: "Transactions",
        children: [
          {
            title: "Stock Received",
            href: "/erp/inventory/transactions/stock-received",
          },
          {
            title: "Delivery Note",
            href: "/erp/inventory/transactions/delivery-note",
          },
          {
            title: "Stock Transfer",
            href: "/erp/inventory/transactions/stock-transfer",
          },
        ],
      },
    ],
  },
  {
    title: "Procurement",
    icon: ShoppingCart,
    environment: "ERP",
    permissions: ["procurement.read"],
    children: [
      { title: "Vendors", href: "/erp/procurement/vendors" },
      {
        title: "Requisition & Quotation",
        children: [
          {
            title: "Purchase Requisition",
            href: "/erp/procurement/purchase-requisition",
          },
          { title: "RFQ", href: "/erp/procurement/rfq" },
          {
            title: "Create Vendor Quotation",
            href: "/erp/procurement/vendor-quotation/create",
          },
          {
            title: "Vendor Quotation List",
            href: "/erp/procurement/vendor-quotation/list",
          },
        ],
      },
      {
        title: "Orders & Receiving",
        children: [
          { title: "Purchase Order", href: "/erp/procurement/purchase-order" },
          { title: "Goods Receipt Note", href: "/erp/procurement/grn" },
        ],
      },
      {
        title: "Landed Cost",
        children: [
          { title: "Landed Cost", href: "/erp/procurement/landed-cost" },
          { title: "Setup", href: "/erp/procurement/landed-cost/setup" },
          { title: "Report", href: "/erp/procurement/landed-cost/report" },
        ],
      },
      { title: "Purchase Invoice", href: "/erp/procurement/purchase-invoice" },
      { title: "Purchase Returns", href: "/erp/procurement/purchase-returns" },
    ],
  },
  {
    title: "Sales",
    icon: TrendingUp,
    environment: "ERP",
    permissions: ["sales.read"],
    children: [
      {
        title: "Customers",
        href: "/erp/sales/customers",
        permissions: ["sales.customer.read"],
      },
      {
        title: "Sales Orders",
        href: "/erp/sales/orders",
        permissions: ["sales.order.read"],
      },
      {
        title: "Delivery Challans",
        href: "/erp/sales/delivery-challans",
        permissions: ["sales.challan.read"],
      },
      {
        title: "Sales Invoices",
        href: "/erp/sales/invoices",
        permissions: ["sales.invoice.read"],
      },
      {
        title: "Reports",
        children: [
          { title: "Sales Summary", href: "/erp/sales/reports/summary" },
          {
            title: "Customer Ledger",
            href: "/erp/sales/reports/customer-ledger",
          },
          {
            title: "Outstanding Invoices",
            href: "/erp/sales/reports/outstanding",
          },
        ],
      },
      {
        title: "Return Claims",
        href: "/erp/claims",
        permissions: ["sales.returns.claims"],
      },
    ],
  },

  {
    title: "Employee Setup",
    icon: Users,
    environment: "HR",
    permissions: [
      "hr.employee.read",
      "hr.employee.create",
      "hr.employee.user-account",
    ],
    children: [
      {
        title: "Employee",
        children: [
          {
            title: "Create",
            href: "/hr/employee/create",
            permissions: ["hr.employee.create"],
          },
          {
            title: "List",
            href: "/hr/employee/list",
            permissions: ["hr.employee.read"],
          },
          {
            title: "Transfer",
            href: "/hr/employee/transfer",
            permissions: ["hr.employee.transfer"],
          },
          {
            title: "User Accounts",
            href: "/hr/employee/user-account",
            permissions: ["hr.employee.user-account"],
          },
        ],
      },
      {
        title: "Exit Clearance",
        icon: LogOut,
        children: [
          {
            title: "Create",
            href: "/hr/exit-clearance/create",
            permissions: ["hr.exit-clearance.create"],
          },
          {
            title: "List",
            href: "/hr/exit-clearance/list",
            permissions: ["hr.exit-clearance.read"],
          },
        ],
      },
    ],
  },

  {
    title: "Attendance Setup",
    icon: Clock,
    environment: "HR",
    permissions: [
      "hr.attendance.view",
      "hr.attendance.update",
      "hr.attendance.exemptions-list",
      "hr.attendance.request-list",
      "hr.attendance.summary",
      "hr.working-hour-policy.read",
      "hr.holiday.read",
    ],
    children: [
      {
        title: "Attendance",
        permissions: [
          "hr.attendance.view",
          "hr.attendance.update",
          "hr.attendance.exemptions-list",
          "hr.attendance.request-list",
          "hr.attendance.summary",
          "hr.request-forwarding.attendance",
        ],
        children: [
          {
            title: "Manage",
            href: "/hr/attendance/manage",
            permissions: ["hr.attendance.update"],
          },
          {
            title: "View",
            href: "/hr/attendance/view",
            permissions: ["hr.attendance.view"],
          },
          {
            title: "Summary",
            href: "/hr/attendance/summary",
            permissions: ["hr.attendance.summary"],
          },
          {
            title: "Request",
            href: "/hr/attendance/request",
            permissions: ["hr.attendance.request"],
          },
          {
            title: "Request List",
            href: "/hr/attendance/request-list",
            permissions: ["hr.attendance.request-list"],
          },
          // {
          //   title: "Exemptions",
          //   href: "/hr/attendance/exemptions",
          //   permissions: ["hr.attendance.exemptions"],
          // },
          // {
          //   title: "Exemptions List",
          //   href: "/hr/attendance/exemptions-list",
          //   permissions: ["hr.attendance.exemptions-list"],
          // },
        ],
      },
      {
        title: "Working Hours Policy",
        permissions: ["hr.working-hour-policy.read"],
        children: [
          {
            title: "Create",
            href: "/hr/working-hours/create",
            permissions: ["hr.working-hour-policy.create"],
          },
          {
            title: "View",
            href: "/hr/working-hours/view",
            permissions: ["hr.working-hour-policy.read"],
          },
          {
            title: "Assign Policy",
            href: "/hr/working-hours/assign-policy",
            permissions: ["hr.working-hour-policy.assign"],
          },
        ],
      },
      {
        title: "Holidays",
        permissions: ["hr.holiday.read"],
        children: [
          {
            title: "Create",
            href: "/hr/holidays/add",
            permissions: ["hr.holiday.create"],
          },
          {
            title: "List",
            href: "/hr/holidays/list",
            permissions: ["hr.holiday.read"],
          },
        ],
      },
    ],
  },
  {
    title: "Leaves Setup",
    icon: Palmtree,
    environment: "HR",
    permissions: ["hr.leave.read", "hr.leave.create"],
    children: [
      {
        title: "Create Leave",
        href: "/hr/leaves/create-leaves",
        permissions: ["hr.leave.create"],
      },
      {
        title: "View Requests",
        href: "/hr/leaves/requests",
        permissions: ["hr.leave.read"], // Allowed for anyone with read permission
      },
    ],
  },
  {
    title: "Request Forwarding",
    icon: Shield,
    environment: "HR",
    permissions: ["hr.request-forwarding.view", "request-forwarding.read"],
    children: [
      {
        title: "Attendance",
        href: "/hr/request-forwarding?type=attendance",
        permissions: [
          "hr.request-forwarding.attendance",
          "request-forwarding.read",
        ],
      },
      {
        title: "Advance Salary",
        href: "/hr/request-forwarding?type=advance-salary",
        permissions: [
          "hr.request-forwarding.advance-salary",
          "request-forwarding.read",
        ],
      },
      {
        title: "Loan",
        href: "/hr/request-forwarding?type=loan",
        permissions: ["hr.request-forwarding.loan", "request-forwarding.read"],
      },
      {
        title: "Leave Application",
        href: "/hr/request-forwarding?type=leave-application",
        permissions: [
          "hr.request-forwarding.leave-application",
          "request-forwarding.read",
        ],
      },
      {
        title: "Leave Encashment",
        href: "/hr/request-forwarding?type=leave-encashment",
        permissions: [
          "hr.request-forwarding.leave-encashment",
          "request-forwarding.read",
        ],
      },
    ],
  },

  {
    title: "Payroll Setup",
    icon: Wallet,
    environment: "HR",
    permissions: [
      "hr.payroll.read",
      "hr.payroll.create",
      "hr.allowance.read",
      "hr.allowance.create",
      "hr.deduction.read",
      "hr.deduction.create",
      "hr.advance-salary.read",
      "hr.advance-salary.create",
      "hr.loan-request.read",
      "hr.loan-request.create",
      "hr.bonus.read",
      "hr.bonus.create",
      "hr.provident-fund.read",
      "hr.provident-fund.create",
      "hr.leave-encashment.read",
      "hr.leave-encashment.create",
    ],
    children: [
      {
        title: "Payroll",
        permissions: ["hr.payroll.read", "hr.payroll.create"],
        children: [
          {
            title: "Create",
            href: "/hr/payroll-setup/payroll/create",
            permissions: ["hr.payroll.create"],
          },
          {
            title: "View Report",
            href: "/hr/payroll-setup/payroll/report",
            permissions: ["hr.payroll.create"],
          },
          {
            title: "Bank Report",
            href: "/hr/payroll-setup/payroll/bank-report",
            permissions: ["hr.payroll.create"],
          },
          {
            title: "Payslips Emails",
            href: "/hr/payroll-setup/payroll/payslips",
            permissions: ["hr.payroll.read"],
          },
        ],
      },
      {
        title: "Allowance",
        permissions: ["hr.allowance.read", "hr.allowance.create"],
        children: [
          {
            title: "Create",
            href: "/hr/payroll-setup/allowance/create",
            permissions: ["hr.allowance.create"],
          },
          {
            title: "View",
            href: "/hr/payroll-setup/allowance/view",
            permissions: ["hr.allowance.read"],
          },
          {
            title: "Bank Report",
            href: "/hr/payroll-setup/allowance/bank-report",
            permissions: ["hr.allowance.read"],
          },
          {
            title: "Allowance Payslip",
            href: "/hr/payroll-setup/allowance/payslip",
            permissions: ["hr.allowance.read"],
          },
        ],
      },
      {
        title: "Deduction",
        permissions: ["hr.deduction.read", "hr.deduction.create"],
        children: [
          {
            title: "Create",
            href: "/hr/payroll-setup/deduction/create",
            permissions: ["hr.deduction.create"],
          },
          {
            title: "View",
            href: "/hr/payroll-setup/deduction/view",
            permissions: ["hr.deduction.read"],
          },
        ],
      },
      {
        title: "Advance Salary",
        permissions: ["hr.advance-salary.read", "hr.advance-salary.create"],
        children: [
          {
            title: "Create Request",
            href: "/hr/payroll-setup/advance-salary/create",
            permissions: ["hr.advance-salary.create"],
          },
          {
            title: "View Requests",
            href: "/hr/payroll-setup/advance-salary/view",
            permissions: ["hr.advance-salary.read"],
          },
        ],
      },
      {
        title: "Loan Requests",
        permissions: ["hr.loan-request.read", "hr.loan-request.create"],
        children: [
          {
            title: "Create Request",
            href: "/hr/loan-requests/create",
            permissions: ["hr.loan-request.create"],
          },
          {
            title: "View & Reports",
            href: "/hr/loan-requests/view",
            permissions: ["hr.loan-request.read"],
          },
          {
            title: "Request Forwarding",
            href: "/hr/request-forwarding?type=loan",
            permissions: ["hr.request-forwarding.loan"],
          },
        ],
      },
      {
        title: "Increment/Decrement",
        permissions: ["hr.increment.read", "hr.increment.create"],
        children: [
          {
            title: "Create",
            href: "/hr/payroll-setup/increment/create",
            permissions: ["hr.increment.create"],
          },
          {
            title: "View",
            href: "/hr/payroll-setup/increment/view",
            permissions: ["hr.increment.read"],
          },
        ],
      },
      {
        title: "Bonus",
        icon: Gift,
        permissions: ["hr.bonus.read", "hr.bonus.create"],
        children: [
          {
            title: "Issue Bonus",
            href: "/hr/payroll-setup/bonus/issue",
            permissions: ["hr.bonus.create"],
          },
          {
            title: "View & Reports",
            href: "/hr/payroll-setup/bonus/view",
            permissions: ["hr.bonus.read"],
          },
          {
            title: "Bank Report",
            href: "/hr/payroll-setup/bonus/bank-report",
            permissions: ["hr.bonus.read"],
          },
          {
            title: "Bonus Payslip",
            href: "/hr/payroll-setup/bonus/payslip",
            permissions: ["hr.bonus.read"],
          },
        ],
      },
      // {
      //   title: "Overtime",
      //   icon: Timer,
      //   children: [
      //     { title: "Create", href: "/hr/payroll-setup/overtime/create" },
      //     { title: "List", href: "/hr/payroll-setup/overtime/view" },

      //     {
      //       title: "Request Forwarding",
      //       href: "/hr/request-forwarding?type=overtime",
      //     },
      //   ],
      // },
      {
        title: "Leave Encashment",
        icon: Coins,
        permissions: ["hr.leave-encashment.read", "hr.leave-encashment.create"],
        children: [
          {
            title: "Create",
            href: "/hr/payroll-setup/leave-encashment/create",
            permissions: ["hr.leave-encashment.create"],
          },
          {
            title: "List",
            href: "/hr/payroll-setup/leave-encashment/list",
            permissions: ["hr.leave-encashment.read"],
          },
          {
            title: "Request Forwarding",
            href: "/hr/request-forwarding?type=leave-encashment",
            permissions: ["hr.request-forwarding.leave-encashment"],
          },
        ],
      },

      {
        title: "PF for Employee",
        permissions: ["hr.provident-fund.read", "hr.provident-fund.create"],
        children: [
          // { title: "Create PF", href: "/hr/payroll-setup/pf-employee/create", permissions: ["hr.provident-fund.create"] },
          {
            title: "View PF",
            href: "/hr/payroll-setup/pf-employee/view",
            permissions: ["hr.provident-fund.read"],
          },
          {
            title: "Create Withdraw",
            href: "/hr/payroll-setup/pf-employee/withdraw-create",
            permissions: ["hr.provident-fund.create"],
          },
          {
            title: "View Withdraw",
            href: "/hr/payroll-setup/pf-employee/withdraw-view",
            permissions: ["hr.provident-fund.read"],
          },
          { title: "View Report", href: "/hr/payroll-setup/pf-employee/report", permissions: ["hr.provident-fund.read"] },
          // { title: "View Ledger", href: "/hr/payroll-setup/pf-employee/ledger", permissions: ["hr.provident-fund.read"] },
        ],
      },
      {
        title: "Social Security",
        permissions: ["hr.social-security.read"],
        children: [
          {
            title: "View Social Security",
            href: "/hr/payroll-setup/social-security-employee/view",
            permissions: ["hr.social-security.read"],
          },
        ],
      },
    ],
  },
  // {
  //   title: "KPI Tracking",
  //   icon: TrendingUp,
  //   environment: "HR",
  //   permissions: ["hr.kpi.read"],
  //   children: [
  //     {
  //       title: "Dashboard",
  //       href: "/hr/kpi/dashboard",
  //       permissions: ["hr.kpi.read"],
  //     },
  //     {
  //       title: "KPI Templates",
  //       href: "/hr/kpi/templates",
  //       permissions: ["hr.kpi.read"],
  //     },
  //     {
  //       title: "KPI Reviews",
  //       href: "/hr/kpi/reviews",
  //       permissions: ["hr.kpi.read"],
  //     },
  //     {
  //       title: "Approvals",
  //       href: "/hr/kpi/approvals",
  //       permissions: ["hr.kpi.approve"],
  //     },
  //   ],
  // },
  // {
  //   title: "Task Management",
  //   icon: CheckSquare,
  //   environment: "HR",
  //   permissions: ["task.project.read", "task.read"],
  //   children: [
  //     {
  //       title: "Projects",
  //       href: "/hr/tasks/projects",
  //       permissions: ["task.project.read"],
  //     },
  //     {
  //       title: "My Tasks",
  //       href: "/hr/tasks/my-tasks",
  //       permissions: ["task.read"],
  //     },
  //   ],
  // },
  {
    title: "Admin",
    icon: Shield,
    environment: "ADMIN",
    children: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Activity Logs", href: "/admin/activity-logs", icon: FileText },
      { title: "Roles & Permissions", href: "/admin/roles", icon: Users },
      { title: "Companies", href: "/admin/companies", icon: Users },
      { title: "System Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    title: "Profile Settings",
    icon: Settings,
    environment: "HR",
    children: [
      { title: "Change Password", href: "/hr/settings/password" },
      { title: "Edit Profile", href: "/hr/settings/profile" },
    ],
  },
  // ── POS: Sales Operations ────────────────────────────────────────────────────
  {
    title: "Sales Operations",
    icon: ShoppingCart,
    environment: "POS",
    permissions: [
      "pos.sale.create",
      "pos.sales.history.view",
      "pos.hold.view",
      "pos.return.create",
      "pos.exchange.create",
      "pos.claim.create",
      "pos.customer.view",
      "pos.ledger.view",
      "pos.voucher.view",
    ],
    children: [
      {
        title: "New Sale",
        href: "/pos/new-sale",
        permissions: ["pos.sale.create"],
      },
      {
        title: "Sale History",
        href: "/pos/sales/history",
        permissions: ["pos.sales.history.view"],
      },
      {
        title: "Hold Orders",
        href: "/pos/holds",
        permissions: ["pos.hold.view"],
      },
      {
        title: "Returns & Exchanges",
        href: "/pos/sales/returns",
        permissions: ["pos.return.create", "pos.exchange.create"],
      },
      {
        title: "Claims",
        href: "/pos/claims",
        permissions: ["pos.claim.create"],
      },
      {
        title: "Customers",
        href: "/pos/customers",
        permissions: ["pos.customer.view"],
      },
      {
        title: "Customer Ledgers",
        href: "/pos/customer-ledger",
        permissions: ["pos.ledger.view"],
      },
      {
        title: "Cash Drawer",
        href: "/pos/shifts",
        permissions: ["pos.terminal.drawer"],
      },
      {
        title: "Vouchers",
        href: "/pos/vouchers",
        permissions: ["pos.voucher.view"],
      },
    ],
  },

  // ── POS: Inventory ───────────────────────────────────────────────────────────
  {
    title: "Inventory",
    icon: Package,
    environment: "POS",
    permissions: [
      "pos.inventory.view",
      "pos.inventory.receiving.view",
      "pos.inventory.returns.view",
      "pos.inventory.inbound.view",
      "pos.inventory.outbound.view",
      "pos.inventory.receipt.view",
      "pos.inventory.transfer.create",
    ],
    children: [
      {
        title: "Stock View",
        href: "/pos/inventory/view",
        permissions: ["pos.inventory.view"],
      },
      {
        title: "Stock Receipts",
        href: "/pos/inventory/receipt",
        permissions: ["pos.inventory.receipt.view"],
      },
      {
        title: "Receiving",
        href: "/pos/inventory/receiving",
        permissions: ["pos.inventory.receiving.view"],
      },
      {
        title: "Inbound Transfers",
        href: "/pos/inventory/inbound",
        permissions: ["pos.inventory.inbound.view"],
      },
      {
        title: "Outbound Transfers",
        href: "/pos/inventory/outbound",
        permissions: ["pos.inventory.outbound.view"],
      },
      {
        title: "Return Requests",
        href: "/pos/inventory/returns",
        permissions: ["pos.inventory.returns.view"],
      },
    ],
  },

  // ── POS: Reports ─────────────────────────────────────────────────────────────
  {
    title: "Reports",
    icon: TrendingUp,
    environment: "POS",
    permissions: ["pos.dashboard.view"],
    children: [
      {
        title: "Sales Reports",
        href: "/pos/reports",
        permissions: ["pos.dashboard.view"],
      },
      {
        title: "Session Summary",
        href: "/pos/session",
        permissions: ["pos.shift.view"],
      },
    ],
  },

  // ── POS: Terminal ────────────────────────────────────────────────────────────
  {
    title: "Terminal",
    icon: Monitor,
    environment: "POS",
    permissions: [
      "pos.shift.view",
      "pos.shift.open",
      "pos.shift.close",
      "pos.terminal.settings",
      "pos.terminal.logout",
    ],
    children: [
      {
        title: "Cash Drawer / Shifts",
        href: "/pos/shifts",
        permissions: ["pos.shift.view", "pos.shift.open", "pos.shift.close"],
      },
      {
        title: "Close Register",
        href: "/pos/close",
        permissions: ["pos.shift.close"],
      },
      {
        title: "Settings",
        href: "/pos/terminal/settings",
        permissions: ["pos.terminal.settings"],
      },
      {
        title: "Logout Terminal",
        href: "/pos/terminal/logout",
        permissions: ["pos.terminal.logout"],
      },
    ],
  },
];

export function flattenMenu(
  items: MenuItem[],
  parentPath = "",
): { title: string; href: string; path: string }[] {
  const result: { title: string; href: string; path: string }[] = [];
  for (const item of items) {
    const currentPath = parentPath
      ? `${parentPath} > ${item.title}`
      : item.title;
    if (item.href) {
      result.push({ title: item.title, href: item.href, path: currentPath });
    }
    if (item.children) {
      result.push(...flattenMenu(item.children, currentPath));
    }
  }
  return result;
}

export function filterMenuByPermissions(
  items: MenuItem[],
  options: {
    hasAnyPermission: (permissions: string[]) => boolean;
    hasAllPermissions: (permissions: string[]) => boolean;
    isAdmin: () => boolean;
  },
): MenuItem[] {
  const { hasAnyPermission, hasAllPermissions, isAdmin } = options;

  // Only bypass permission checks for super_admin role
  // Regular admin roles and all other roles must respect their assigned permissions
  // This ensures role-based access control works correctly
  if (isAdmin()) {
    // isAdmin() now only returns true for super_admin
    return items;
  }

  const filterItems = (source: MenuItem[]): MenuItem[] => {
    const result: MenuItem[] = [];

    for (const item of source) {
      const hasOwnPermissions = item.permissions && item.permissions.length > 0;

      // For items with children, filter children FIRST
      // Then decide if parent should be shown based on accessible children
      const children = item.children ? filterItems(item.children) : undefined;

      // If item has children and all children were filtered out, hide parent
      // UNLESS it's "Profile Settings" which should always be shown
      if (
        item.children &&
        (!children || children.length === 0) &&
        !item.href &&
        item.title !== "Profile Settings"
      ) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `RBAC Filter Parent: ${item.title} - All children filtered out, hiding parent`,
          );
        }
        continue;
      }

      // Now check if parent itself should be shown
      let allowed = true; // Default to true for items without permissions

      // If item has permissions defined, check them
      if (hasOwnPermissions) {
        // Use normal OR/AND logic - if user has ANY of the required permissions, show the menu
        allowed = item.requireAllPermissions
          ? hasAllPermissions(item.permissions!)
          : hasAnyPermission(item.permissions!);

        if (process.env.NODE_ENV === "development") {
          console.log(`RBAC Filter Item: ${item.title}`, {
            required: item.permissions,
            allowed,
            hasOwnPermissions,
            hasAnyPermission: hasAnyPermission(item.permissions!),
            hasAllPermissions: hasAllPermissions(item.permissions!),
            accessibleChildren: children?.length || 0,
          });
        }

        // If user doesn't have required permissions, skip this item
        // UNLESS it has accessible children (in which case we already checked above)
        if (
          !allowed &&
          (!item.children || !children || children.length === 0)
        ) {
          continue;
        }

        // If parent doesn't have permissions but has accessible children, show it
        if (!allowed && children && children.length > 0) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `RBAC Filter Parent: ${item.title} - Showing parent because user has access to ${children.length} child(ren) even without parent permissions`,
            );
          }
          allowed = true; // Override to show parent
        }
      } else {
        // Items without permissions are only allowed if they have no children OR
        // if they're explicitly public items like Dashboard
        // For security, we'll hide items without permissions unless they're explicitly marked
        // Dashboard is an exception - it should be visible to all authenticated users
        if (
          item.title === "Profile Settings" ||
          item.title === "Change Password" ||
          item.title === "Edit Profile"
        ) {
          allowed = true; // Allow Profile Settings for all authenticated users
        } else if (item.children && (!children || children.length === 0)) {
          // Hide items without permissions if they have no accessible children
          // UNLESS it's "Profile Settings"
          if (process.env.NODE_ENV === "development") {
            console.log(
              `RBAC Filter Item: ${item.title} - No permissions defined and no accessible children, hiding for security`,
            );
          }
          if (item.title !== "Profile Settings") {
            continue;
          }
        } else if (item.children && children && children.length > 0) {
          // Item has no permissions but has accessible children - show it
          allowed = true;
        } else {
          // Hide other items without permissions for security
          if (process.env.NODE_ENV === "development") {
            console.log(
              `RBAC Filter Item: ${item.title} - No permissions defined, hiding for security`,
            );
          }
          continue;
        }
      }

      result.push({
        ...item,
        children,
      });
    }

    return result;
  };

  return filterItems(items);
}
