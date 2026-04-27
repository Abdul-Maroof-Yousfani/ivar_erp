import { authFetch } from "./auth";
import { getApiBaseUrl } from "./utils";


export async function fetchApi<T>(endpoint: string, options?: any): Promise<T> {
  const res = await authFetch(`${getApiBaseUrl()}${endpoint}`, options);
  if (!res.ok) {
    throw new Error(res.data?.message || 'Something went wrong');
  }
  return res.data as T;
}

// Department API
export const departmentApi = {
  getAll: () => fetchApi<{ status: boolean; data: Department[] }>('/departments'),
  getById: (id: number) => fetchApi<{ status: boolean; data: Department }>(`/departments/${id}`),
  create: (name: string) => fetchApi<{ status: boolean; data: Department; message: string }>('/departments', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  update: (id: number, name: string) => fetchApi<{ status: boolean; data: Department; message: string }>(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  }),
  delete: (id: number) => fetchApi<{ status: boolean; message: string }>(`/departments/${id}`, {
    method: 'DELETE',
  }),
};

// Sub-Department API
export const subDepartmentApi = {
  getAll: () => fetchApi<{ status: boolean; data: SubDepartment[] }>('/sub-departments'),
  getByDepartment: (departmentId: number) => fetchApi<{ status: boolean; data: SubDepartment[] }>(`/sub-departments/department/${departmentId}`),
  create: (name: string, departmentId: number) => fetchApi<{ status: boolean; data: SubDepartment; message: string }>('/sub-departments', {
    method: 'POST',
    body: JSON.stringify({ name, departmentId }),
  }),
  update: (id: number, name: string, departmentId?: number) => fetchApi<{ status: boolean; data: SubDepartment; message: string }>(`/sub-departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, departmentId }),
  }),
  delete: (id: number) => fetchApi<{ status: boolean; message: string }>(`/sub-departments/${id}`, {
    method: 'DELETE',
  }),
};

export interface DashboardStats {
  overview: {
    totalEmployees: { value: number; trend?: number; trendType?: 'up' | 'down' };
    inactiveEmployees: { value: number };
    presentToday: { value: number; trend?: number; trendType?: 'up' | 'down' };
    absentToday: { value: number };
    pendingLeaves: { value: number; trend?: number; trendType?: 'up' | 'down' };
    pendingAttendanceQueries: { value: number; trend?: number; trendType?: 'up' | 'down' };
  };
  departmentStats: {
    name: string;
    count: number;
  }[];
  upcomingBirthdays: {
    name: string;
    date: string;
    department: string;
  }[];
  upcomingAnniversaries: {
    name: string;
    date: string;
    years: number;
    department: string;
  }[];
  criticalAlerts: {
    type: string;
    priority: 'high' | 'medium' | 'low';
    message: string;
    employeeId: string;
  }[];
  analyticsSuggestions: {
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }[];

  attendanceTrend: {
    date: string;
    present: number;
    absent: number;
  }[];
  recentLeaveRequests: {
    id: string;
    employeeName: string;
    department: string;
    type: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    days: number;
  }[];
}

export interface Employee {
  id: string;
  employeeId: string;
  employeeName: string;
  fatherHusbandName?: string;
  cnicNumber?: string;
  cnicExpiryDate?: string;
  lifetimeCnic?: boolean;
  joiningDate?: string;
  dateOfBirth?: string;
  nationality?: string;
  gender?: string;
  contactNumber?: string;
  emergencyContactNumber?: string;
  emergencyContactPersonName?: string;
  personalEmail?: string;
  officialEmail?: string;
  currentAddress?: string;
  permanentAddress?: string;
  bankName?: string;
  accountNumber?: string;
  accountTitle?: string;
  accountType?: string;
  employeeSalary?: number;
  department?: { id: string; name: string } | string;
  subDepartment?: { id: string; name: string } | string;
  designation?: { id: string; name: string } | string;
  employeeGrade?: { id: string; grade: string } | string;
  maritalStatus?: { id: string; name: string } | string;
  employmentStatus?: { id: string; status: string } | string;
  country?: { id: string; name: string } | string;
  state?: { id: string; name: string } | string;
  city?: { id: string; name: string } | string;
  workingHoursPolicy?: { id: string; name: string } | string;
  leavesPolicy?: { id: string; name: string } | string;

  // Relation objects for display
  departmentRelation?: { id: string; name: string };
  subDepartmentRelation?: { id: string; name: string };
  designationRelation?: { id: string; name: string };
  employeeGradeRelation?: { id: string; grade: string };
  maritalStatusRelation?: { id: string; name: string };
  employmentStatusRelation?: { id: string; status: string };
  countryRelation?: { id: string; name: string };
  stateRelation?: { id: string; name: string };
  cityRelation?: { id: string; name: string };
  workingHoursPolicyRelation?: {
    id: string;
    name: string;
    startWorkingHours?: string;
    endWorkingHours?: string;
    startBreakTime?: string;
    endBreakTime?: string;
    lateStartTime?: string;
    shortDayMins?: number;
  };
  leavesPolicyRelation?: { id: string; name: string };
  avatarUrl?: string | null;
  qualifications?: {
    id: string;
    degree: string;
    institution: string;
    passingYear: string;
    gradeOrDivision?: string;
  }[];
  createdAt: string;
  updatedAt: string;
  status: string;
}

export const employeeApi = {
  getProfile: (id: string, includeHistory: boolean = false) =>
    fetchApi<{ status: boolean; data: Employee }>(`/employees/${id}?includeHistory=${includeHistory}`),
};

export const dashboardApi = {
  getStats: () => fetchApi<{ status: boolean; data: DashboardStats }>('/dashboard/stats'),
  getEmployeeStats: () => fetchApi<{ status: boolean; data: EmployeeDashboardStats }>('/dashboard/employee-stats'),
};

export interface EmployeeDashboardStats {
  overview: {
    presentMonth: number;
    absentMonth: number;
    lateMonth: number;
    pendingLeaves: number;
    pendingAttendanceQueries: number;
  };
  upcomingHoliday?: {
    name: string;
    dateFrom: string;
    dateTo: string;
  };
  recentActivities: {
    date: string;
    checkIn?: string;
    checkOut?: string;
    status: string;
  }[];
}

// Types
export interface Department {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  subDepartments?: SubDepartment[];
}

export interface SubDepartment {
  id: number;
  name: string;
  departmentId: number;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

// purchaseRequisitionApise Requisition Types and API
export interface PurchaseRequisition {
  id: string;
  prNumber: string;
  department?: string;
  requestDate: string;
  status: string;
  notes?: string;
  type?: string;
  goodsType?: string; // CONSUMABLE, FRESH
  items: PurchaseRequisitionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequisitionItem {
  id: string;
  itemId: string;
  requiredQty: string;
}

export const purchaseRequisitionApi = {
  getAll: (status?: string) => fetchApi<PurchaseRequisition[]>(`/purchase-requisition${status ? `?status=${status}` : ''}`),
  getById: (id: string) => fetchApi<PurchaseRequisition>(`/purchase-requisition/${id}`),
  create: (data: any) => fetchApi<PurchaseRequisition>('/purchase-requisition', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => fetchApi<PurchaseRequisition>(`/purchase-requisition/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/purchase-requisition/${id}`, {
    method: 'DELETE',
  }),
};


// RFQ Types and API

export interface RfqVendor {
  id: string;
  vendorId: string;
  sentAt?: string;
  responseStatus: string;
  vendor: {
    id: string;
    code: string;
    name: string;
    email?: string;
    contactNo?: string;
  };
}

export interface RequestForQuotation {
  id: string;
  rfqNumber: string;
  purchaseRequisitionId: string;
  rfqDate: string;
  status: string;
  notes?: string;
  vendors: RfqVendor[];
  purchaseRequisition: PurchaseRequisition;
  createdAt: string;
  updatedAt: string;
}

export const rfqApi = {
  getAll: (status?: string) => fetchApi<RequestForQuotation[]>(`/rfq${status ? `?status=${status}` : ''}`),
  getById: (id: string) => fetchApi<RequestForQuotation>(`/rfq/${id}`),
  create: (data: any) => fetchApi<RequestForQuotation>('/rfq', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  addVendors: (id: string, vendorIds: string[]) => fetchApi<RequestForQuotation>(`/rfq/${id}/vendors`, {
    method: 'POST',
    body: JSON.stringify({ vendorIds }),
  }),
  markAsSent: (id: string) => fetchApi<RequestForQuotation>(`/rfq/${id}/send`, {
    method: 'POST',
  }),
  update: (id: string, data: any) => fetchApi<RequestForQuotation>(`/rfq/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/rfq/${id}`, {
    method: 'DELETE',
  }),
};

// Item API
export interface MasterItem {
  id: string;
  itemId: string;
  sku: string;
  name?: string;
  code?: string;
  unitPrice?: number;
  fob?: number;
  unitCost?: number;
  taxRate1?: number;
  taxRate2?: number;
  discountRate?: number;
  hsCodeId?: string;
  hsCodeStr?: string;
  hsCode?: HsCode;
  brand?: { name: string };
  category?: { name: string };
  division?: { name: string };
  itemClass?: { name: string };
  itemSubclass?: { name: string };
  description?: string;
}

export const itemApi = {
  getAll: () => fetchApi<{ status: boolean; data: MasterItem[] }>('/finance/items'),
  getById: (id: string) => fetchApi<{ status: boolean; data: MasterItem }>(`/finance/items/${id}`),
  getByCode: (code: string) => fetchApi<{ status: boolean; data: MasterItem }>(`/finance/items/code/${code}`),
};


// Vendor Quotation Types and API

export interface VendorQuotationItem {
  id: string;
  itemId: string;
  description?: string;
  quotedQty: string;
  unitPrice: string;
  taxPercent: string;
  discountPercent: string;
  lineTotal: string;
  item?: MasterItem;
}

export interface VendorQuotation {
  id: string;
  rfqId: string;
  vendorId: string;
  quotationDate: string;
  expiryDate?: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  notes?: string;
  items: VendorQuotationItem[];
  vendor: {
    id: string;
    code: string;
    name: string;
    email?: string;
    contactNo?: string;
  };
  rfq: RequestForQuotation;
  createdAt: string;
  updatedAt: string;
}

export const vendorQuotationApi = {
  getAll: (rfqId?: string) => fetchApi<VendorQuotation[]>(`/vendor-quotation${rfqId ? `?rfqId=${rfqId}` : ''}`),
  getById: (id: string) => fetchApi<VendorQuotation>(`/vendor-quotation/${id}`),
  compare: (rfqId: string) => fetchApi<VendorQuotation[]>(`/vendor-quotation/compare/${rfqId}`),
  create: (data: any) => fetchApi<VendorQuotation>('/vendor-quotation', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  submit: (id: string) => fetchApi<VendorQuotation>(`/vendor-quotation/${id}/submit`, {
    method: 'POST',
  }),
  select: (id: string) => fetchApi<VendorQuotation>(`/vendor-quotation/${id}/select`, {
    method: 'POST',
  }),
  update: (id: string, data: any) => fetchApi<VendorQuotation>(`/vendor-quotation/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/vendor-quotation/${id}`, {
    method: 'DELETE',
  }),
};

// Purchase Order Types and API

export interface PurchaseOrderItem {
  id: string;
  itemId: string;
  description?: string;
  quantity: string;
  receivedQty: string;
  unitPrice: string;
  taxPercent: string;
  discountPercent: string;
  lineTotal: string;
  item?: MasterItem;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorQuotationId: string;
  vendorId: string;
  rfqId?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  notes?: string;
  orderType?: string;
  goodsType?: string;
  items: PurchaseOrderItem[];
  vendor: {
    name: string;
    code: string;
    email?: string;
    contactNo?: string;
  };
  vendorQuotation?: VendorQuotation;
  createdAt: string;
  updatedAt: string;
}

export const purchaseOrderApi = {
  getAll: () => fetchApi<PurchaseOrder[]>('/purchase-order'),
  getPendingQuotations: () => fetchApi<VendorQuotation[]>('/purchase-order/pending-quotations'),
  getById: (id: string) => fetchApi<PurchaseOrder>(`/purchase-order/${id}`),
  create: (data: {
    vendorQuotationId?: string;
    vendorId?: string;
    purchaseRequisitionId?: string;
    items?: {
      itemId: string;
      description?: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    expectedDeliveryDate?: string;
    orderType?: string;
    goodsType?: string;
  }) =>
    fetchApi<PurchaseOrder>('/purchase-order', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  awardFromRfq: (data: {
    rfqId: string;
    awards: {
      vendorQuotationId: string;
      items: { itemId: string; quantity: number }[];
      notes?: string;
      expectedDeliveryDate?: string;
    }[];
  }) =>
    fetchApi<PurchaseOrder[]>('/purchase-order/award-from-rfq', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createMultiDirect: (data: {
    awards: {
      vendorId: string;
      items: {
        itemId: string;
        description?: string;
        quantity: number;
        unitPrice: number;
      }[];
      notes?: string;
      expectedDeliveryDate?: string;
      orderType?: string;
      goodsType?: string;
    }[];
  }) =>
    fetchApi<PurchaseOrder[]>('/purchase-order/multi-direct', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string) =>
    fetchApi<PurchaseOrder>(`/purchase-order/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// GRN & Warehouse Types and API

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  type: string;
  description?: string;
  isActive: boolean;
  managerId?: string;
  createdAt: string;
  locations?: WarehouseLocation[];
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  type: string;
  barcode?: string;
  isActive: boolean;
  parent?: WarehouseLocation;
  children?: WarehouseLocation[];
}

export interface GrnItem {
  id: string;
  itemId: string;
  description?: string;
  receivedQty: string;
  item?: MasterItem;
}

export interface Grn {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  warehouseId: string;
  receivedDate: string;
  status: string;
  notes?: string;
  orderType?: string;
  goodsType?: string;
  items: GrnItem[];
  purchaseOrder?: {
    poNumber: string;
  };
  warehouse?: {
    name: string;
  };
  createdAt: string;
}

export const grnApi = {
  getAll: () => fetchApi<Grn[]>('/grn'),
  getById: (id: string) => fetchApi<Grn>(`/grn/${id}`),
  create: (data: {
    purchaseOrderId: string;
    warehouseId: string;
    notes?: string;
    items: { itemId: string; description?: string; receivedQty: number }[];
  }) =>
    fetchApi<Grn>('/grn', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// HS Code API
export interface HsCode {
  id: string;
  hsCode: string;
  customsDutyCd: number;
  regulatoryDutyRd: number;
  additionalCustomsDutyAcd: number;
  salesTax: number;
  additionalSalesTax: number;
  incomeTax: number;
  status: string;
}

export const hsCodeApi = {
  getAll: () => fetchApi<{ status: boolean; data: HsCode[] }>('/hs-codes'),
  getById: (id: string) => fetchApi<{ status: boolean; data: HsCode }>(`/hs-codes/${id}`),
};

// Landed Cost API
export interface LandedCostItem {
  itemId: string;
  hsCode?: string;
  qty: number;
  unitFob: number;
  freightForeign: number;
  insuranceCharges: number;
  landingCharges: number;
  assessableValue: number;
  unitCostPKR: number;
  totalCostPKR: number;
}

export interface LandedCostCharge {
  accountId: string;
  amount: number;
  description?: string;
}

export interface CreateLandedCostDto {
  grnId: string;
  supplierId: string;
  purchaseOrderId?: string;
  lcNo?: string;
  blNo?: string;
  blDate?: string;
  countryOfOrigin?: string;
  gdNo?: string;
  gdDate?: string;
  season?: string;
  category?: string;
  shippingInvoiceNo?: string;
  currency: string;
  exchangeRate: number;
  items: LandedCostItem[];
  charges?: LandedCostCharge[];
}

export const landedCostApi = {
  create: (data: CreateLandedCostDto) =>
    fetchApi<any>('/landed-cost', { method: 'POST', body: JSON.stringify(data) }),
  createLocal: (data: any) =>
    fetchApi<any>('/landed-cost/local', { method: 'POST', body: JSON.stringify(data) }),
  getAll: () => fetchApi<any[]>('/landed-cost'),
  getById: (id: string) => fetchApi<any>(`/landed-cost/${id}`),
  listChargeTypes: () => fetchApi<{ status: boolean; data: LandedCostChargeType[] }>('/landed-cost/charge-types'),
  post: (data: { grnId: string; charges: { accountId: string; amount: number }[] }) =>
    fetchApi<any>('/landed-cost/post', { method: 'POST', body: JSON.stringify(data) }),
};


// Landed Cost Charge Types (client-side)
export interface LandedCostChargeType {
  id: string;
  name: string;
  accountId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; name: string; code: string; type: string };
}
export const landedCostChargeTypeApi = {
  getAll: () => fetchApi<{ status: boolean; data: LandedCostChargeType[] }>('/landed-cost/charge-types'),
  create: (data: { name: string; accountId: string }) =>
    fetchApi<{ status: boolean; data: LandedCostChargeType }>('/landed-cost/charge-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};


// Chart of Accounts API (client-side)
export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isGroup: boolean;
}

export const chartOfAccountApi = {
  getAll: () => fetchApi<ChartOfAccount[]>('/finance/chart-of-accounts'),
};

// Purchase Return API
export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  sourceType: 'GRN' | 'LANDED_COST';
  grnId?: string;
  landedCostId?: string;
  supplierId: string;
  warehouseId: string;
  returnDate: string;
  returnType: 'DEFECTIVE' | 'EXCESS' | 'WRONG_ITEM' | 'DAMAGED';
  reason?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseReturnItem[];
  grn?: any;
  landedCost?: any;
  supplier?: any;
  warehouse?: any;
  debitNote?: DebitNote;
}

export interface PurchaseReturnItem {
  id: string;
  sourceItemType: 'GRN_ITEM' | 'LANDED_COST_ITEM';
  grnItemId?: string;
  landedCostItemId?: string;
  itemId: string;
  description?: string;
  returnQty: number;
  unitPrice: number;
  lineTotal: number;
  reason?: string;
  item?: MasterItem;
}

export interface CreatePurchaseReturnDto {
  sourceType: 'GRN' | 'LANDED_COST';
  grnId?: string;
  landedCostId?: string;
  supplierId: string;
  warehouseId: string;
  returnType: 'DEFECTIVE' | 'EXCESS' | 'WRONG_ITEM' | 'DAMAGED';
  reason?: string;
  notes?: string;
  items: {
    sourceItemType: 'GRN_ITEM' | 'LANDED_COST_ITEM';
    grnItemId?: string;
    landedCostItemId?: string;
    itemId: string;
    description?: string;
    returnQty: number;
    unitPrice: number;
    lineTotal: number;
    reason?: string;
  }[];
}

export interface UpdatePurchaseReturnDto extends Partial<CreatePurchaseReturnDto> { }

export const purchaseReturnApi = {
  list: (params?: { status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<PurchaseReturn[]>(`/purchase/purchase-returns?${query}`);
  },
  create: (data: CreatePurchaseReturnDto) =>
    fetchApi<PurchaseReturn>('/purchase/purchase-returns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getById: (id: string) =>
    fetchApi<PurchaseReturn>(`/purchase/purchase-returns/${id}`),
  update: (id: string, data: UpdatePurchaseReturnDto) =>
    fetchApi<PurchaseReturn>(`/purchase/purchase-returns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string, approvedBy?: string) =>
    fetchApi<PurchaseReturn>(`/purchase/purchase-returns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, approvedBy }),
    }),
  delete: (id: string) =>
    fetchApi(`/purchase/purchase-returns/${id}`, { method: 'DELETE' }),
  getEligibleGrns: () =>
    fetchApi<any[]>('/purchase/purchase-returns/eligible-grns'),
  getEligibleLandedCosts: () =>
    fetchApi<any[]>('/purchase/purchase-returns/eligible-landed-costs'),
};

export const warehouseApi = {
  getAll: () => fetchApi<Warehouse[]>('/warehouse'),
  getById: (id: string) => fetchApi<Warehouse>(`/warehouse/${id}`),
  create: (data: Partial<Warehouse>) => fetchApi<Warehouse>('/warehouse', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<Warehouse>) => fetchApi<Warehouse>(`/warehouse/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/warehouse/${id}`, {
    method: 'DELETE',
  }),
};

export const locationApi = {
  getAll: () => fetchApi<{ status: boolean; data: any[] }>('/locations'),
  getByWarehouse: (warehouseId: string) => fetchApi<WarehouseLocation[]>(`/warehouse/${warehouseId}/locations`),
  create: (data: Partial<WarehouseLocation>) => fetchApi<WarehouseLocation>('/warehouse/location', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateStatus: (id: string, isActive: boolean) => fetchApi<WarehouseLocation>(`/warehouse/location/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  }),
};

// Stock Ledger Types and API
export enum MovementType {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
  OPENING_BALANCE = 'OPENING_BALANCE'
}

export interface StockLedgerEntry {
  id: string;
  itemId: string;
  warehouseId: string;
  qty: string;
  unitCost?: string;
  rate?: string;
  movementType: MovementType;
  referenceType: string;
  referenceId: string;
  locationId?: string;
  createdAt: string;
  // Optional expanded relations if backend includes them
  item?: { itemId: string; sku: string; description: string | null; name?: string };
  warehouse?: { name: string };
  location?: { name: string; code: string } | null;
}

export interface StockLevel {
  itemId: string;
  warehouseId: string;
  locationId?: string;
  totalQty: string;
  item: {
    itemId: string;
    sku: string;
    description: string | null;
    uomId: string | null;
  } | null;
  warehouse: {
    name: string;
    code: string;
  } | null;
  location: {
    name: string;
    code: string;
    type: string;
  } | null;
}

export const stockLedgerApi = {
  getAll: (params?: { warehouseId?: string, movementType?: MovementType, itemId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<StockLedgerEntry[]>(`/stock-ledger?${query}`);
  },
  getLevels: (params?: { warehouseId?: string, locationId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<StockLevel[]>(`/stock-ledger/levels?${query}`);
  }
};
export const posSalesApi = {
  lookup: (query: string) => fetchApi<{ status: boolean; data: any[] }>(`/pos-sales/lookup?q=${encodeURIComponent(query)}`),
  getAll: (params?: { page?: number; limit?: number; search?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ status: boolean; data: any[]; meta: any }>(`/pos-sales/orders?${query}`);
  },
};

export const transferRequestApi = {
  create: (data: any) => fetchApi<{ status: boolean; data: any; message: string }>('/transfer-request', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  createReturn: (data: {
    fromLocationId: string;
    fromWarehouseId: string;
    items: { itemId: string; quantity: number }[];
    notes?: string;
    createdById?: string;
  }) => fetchApi<{ status: boolean; data: any; message: string }>('/transfer-request', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      transferType: 'OUTLET_TO_WAREHOUSE',
      toLocationId: null,
    }),
  }),

  createOutletToOutlet: (data: {
    fromLocationId: string;
    toLocationId: string;
    items: { itemId: string; quantity: number }[];
    notes?: string;
    createdById?: string;
  }) => fetchApi<{ status: boolean; data: any; message: string }>('/transfer-request', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      transferType: 'OUTLET_TO_OUTLET',
    }),
  }),

  getAll: (params?: { warehouseId?: string, status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ status: boolean; data: any[] }>(`/transfer-request?${query}`);
  },
  getIncoming: (locationId: string) => fetchApi<{ status: boolean; data: any[] }>(`/transfer-request/incoming?locationId=${locationId}`),

  getReturnRequests: (locationId: string) => fetchApi<{ status: boolean; data: any[] }>(`/transfer-request/return-requests?locationId=${locationId}`),

  getOutboundRequests: (locationId: string) => fetchApi<{ status: boolean; data: any[] }>(`/transfer-request/outbound-requests?locationId=${locationId}`),

  getInboundRequests: (locationId: string) => fetchApi<{ status: boolean; data: any[] }>(`/transfer-request/inbound-requests?locationId=${locationId}`),

  updateStatus: (id: string, status: string) => fetchApi<{ status: boolean; message: string }>(`/transfer-request/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  accept: (id: string, userId?: string) => fetchApi<{ status: boolean; data: any; message: string }>(`/transfer-request/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }),
  approveSource: (id: string, userId?: string) => fetchApi<{ status: boolean; data: any; message: string }>(`/transfer-request/${id}/approve-source`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }),
};

export const inventoryApi = {
  search: (
    query: string,
    warehouseId?: string,
    locationId?: string,
    filters?: {
      brandIds?: string[];
      categoryIds?: string[];
      silhouetteIds?: string[];
      genderIds?: string[];
    }
  ) => {
    const params = new URLSearchParams({ q: query });
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (locationId) params.append('locationId', locationId);
    if (filters?.brandIds?.length) params.append('brandIds', filters.brandIds.join(','));
    if (filters?.categoryIds?.length) params.append('categoryIds', filters.categoryIds.join(','));
    if (filters?.silhouetteIds?.length) params.append('silhouetteIds', filters.silhouetteIds.join(','));
    if (filters?.genderIds?.length) params.append('genderIds', filters.genderIds.join(','));
    return fetchApi<{ status: boolean; data: any[] }>(`/inventory/search?${params.toString()}`);
  },
  getDetails: (itemId: string) => fetchApi<{ status: boolean; data: any[] }>(`/inventory/details/${itemId}`),
};

export const brandApi = {
  getAll: () => fetchApi<{ status: boolean; data: any[] }>('/brands'),
};

export const categoryApi = {
  getAll: () => fetchApi<{ status: boolean; data: any[] }>('/master/erp/category'),
};

export const silhouetteApi = {
  getAll: () => fetchApi<{ status: boolean; data: any[] }>('/silhouettes'),
};

export const genderApi = {
  getAll: () => fetchApi<{ status: boolean; data: any[] }>('/genders'),
};

export const stockOperationApi = {
  move: (data: {
    itemId: string;
    fromLocationId?: string;
    toLocationId?: string;
    quantity: number;
    type: 'TRANSFER' | 'INBOUND' | 'OUTBOUND';
    notes?: string;
  }) => fetchApi<any>('/stock-operation/move', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Purchase Invoice Types and API
export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  supplierId: string;
  grnId?: string;
  landedCostId?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  returnAmount: number;
  remainingAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERDUE';
  notes?: string;
  items: PurchaseInvoiceItem[];
  supplier?: { id: string; name: string; code: string };
  grn?: { id: string; grnNumber: string };
  landedCost?: { id: string; landedCostNumber: string };
  paymentVouchers?: {
    id: string;
    paidAmount: number;
    paymentVoucher: { id: string; pvNo: string; pvDate: string };
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  itemId: string;
  grnItemId?: string;
  landedCostItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  item?: MasterItem;
}

export const purchaseInvoiceApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    supplierId?: string;
    status?: string;
    paymentStatus?: string;
    search?: string;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ data: PurchaseInvoice[]; pagination: any }>(`/purchase/purchase-invoices?${query}`);
  },

  getById: (id: string) => fetchApi<PurchaseInvoice>(`/purchase/purchase-invoices/${id}`),

  create: (data: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    supplierId: string;
    grnId?: string;
    landedCostId?: string;
    discountAmount?: number;
    notes?: string;
    items: {
      itemId: string;
      grnItemId?: string;
      landedCostItemId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
      discountRate?: number;
    }[];
  }) => fetchApi<PurchaseInvoice>('/purchase/purchase-invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: Partial<PurchaseInvoice>) =>
    fetchApi<PurchaseInvoice>(`/purchase/purchase-invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  approve: (id: string) =>
    fetchApi<PurchaseInvoice>(`/purchase/purchase-invoices/${id}/approve`, {
      method: 'PATCH',
    }),

  cancel: (id: string, reason?: string) =>
    fetchApi<PurchaseInvoice>(`/purchase/purchase-invoices/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  delete: (id: string) => fetchApi<void>(`/purchase/purchase-invoices/${id}`, {
    method: 'DELETE',
  }),

  getNextInvoiceNumber: () =>
    fetchApi<{ nextInvoiceNumber: string }>('/purchase/purchase-invoices/next-invoice-number'),

  getSummary: (supplierId?: string) => {
    const query = supplierId ? `?supplierId=${supplierId}` : '';
    return fetchApi<{
      totalInvoices: number;
      draftInvoices: number;
      approvedInvoices: number;
      totalAmount: number;
      paidAmount: number;
      pendingAmount: number;
    }>(`/purchase/purchase-invoices/summary${query}`);
  },

  getValuedGrns: () => fetchApi<any[]>('/purchase/purchase-invoices/valued-grns'),

  getAvailableLandedCosts: () => fetchApi<any[]>('/purchase/purchase-invoices/available-landed-costs'),
};

// Payment Voucher Types and API
export interface PaymentVoucher {
  id: string;
  type: 'bank' | 'cash';
  pvNo: string;
  pvDate: string;
  refBillNo?: string;
  billDate?: string;
  chequeNo?: string;
  chequeDate?: string;
  creditAccountId: string;
  supplierId?: string;
  creditAmount: number;
  isAdvance: boolean;
  isTaxApplicable: boolean;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  details: PaymentVoucherDetail[];
  creditAccount?: { id: string; name: string; code: string };
  supplier?: { id: string; name: string; code: string };
  createdAt: string;
  updatedAt: string;
}

export interface PaymentVoucherDetail {
  id: string;
  paymentVoucherId: string;
  accountId: string;
  debit: number;
  account?: { id: string; name: string; code: string };
}

export const paymentVoucherApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    search?: string;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ data: PaymentVoucher[]; pagination: any }>(`/finance/payment-vouchers?${query}`);
  },

  getById: (id: string) => fetchApi<PaymentVoucher>(`/finance/payment-vouchers/${id}`),

  create: (data: {
    type: 'bank' | 'cash';
    pvNo: string;
    pvDate: string;
    refBillNo?: string;
    billDate?: string;
    chequeNo?: string;
    chequeDate?: string;
    creditAccountId: string;
    supplierId?: string;
    creditAmount: number;
    isAdvance?: boolean;
    isTaxApplicable?: boolean;
    description: string;
    details: {
      accountId: string;
      debit: number;
    }[];
  }) => fetchApi<PaymentVoucher>('/finance/payment-vouchers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: Partial<PaymentVoucher>) =>
    fetchApi<PaymentVoucher>(`/finance/payment-vouchers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, status: string, remarks?: string) =>
    fetchApi<PaymentVoucher>(`/finance/payment-vouchers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remarks }),
    }),

  delete: (id: string) => fetchApi<void>(`/finance/payment-vouchers/${id}`, {
    method: 'DELETE',
  }),

  getNextPvNumber: (type: 'bank' | 'cash') =>
    fetchApi<{ nextPvNumber: string }>(`/finance/payment-vouchers/next-pv-number?type=${type}`),

  getSummary: (type?: string) => {
    const query = type ? `?type=${type}` : '';
    return fetchApi<{
      totalVouchers: number;
      pendingVouchers: number;
      approvedVouchers: number;
      totalAmount: number;
      pendingAmount: number;
    }>(`/finance/payment-vouchers/summary${query}`);
  },
};

// Supplier API (if not already exists)
export interface Supplier {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export const supplierApi = {
  getAll: () => fetchApi<{ status: boolean; data: Supplier[] }>('/finance/suppliers'),
  getById: (id: string) => fetchApi<{ status: boolean; data: Supplier }>(`/finance/suppliers/${id}`),
  create: (data: Partial<Supplier>) => fetchApi<{ status: boolean; data: Supplier }>('/finance/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<Supplier>) => fetchApi<{ status: boolean; data: Supplier }>(`/finance/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<{ status: boolean; message: string }>(`/finance/suppliers/${id}`, {
    method: 'DELETE',
  }),
};

// Debit Note API
export interface DebitNote {
  id: string;
  debitNoteNo: string;
  date: string;
  amount: number;
  status: string;
  purchaseReturnId?: string;
  purchaseInvoiceId?: string;
  supplierId: string;
  purchaseReturn?: PurchaseReturn;
  purchaseInvoice?: PurchaseInvoice;
  supplier?: Supplier;
  createdAt: string;
  updatedAt: string;
}

export const debitNoteApi = {
  getAll: () => fetchApi<DebitNote[]>('/purchase/debit-notes'),
  getById: (id: string) => fetchApi<DebitNote>(`/purchase/debit-notes/${id}`),
  getBySupplier: (supplierId: string) => fetchApi<DebitNote[]>(`/purchase/debit-notes/supplier/${supplierId}`),
  getByInvoice: (invoiceId: string) => fetchApi<DebitNote[]>(`/purchase/debit-notes/invoice/${invoiceId}`),
};
// Sales Module APIs
export interface Customer {
  id: string;
  code: string;
  name: string;
  address?: string;
  contactNo?: string;
  email?: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  customerId: string;
  customer: Customer;
  warehouseId?: string;
  orderDate: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  grandTotal: number;
  items: SalesOrderItem[];
}

export interface SalesOrderItem {
  id: string;
  itemId: string;
  item: any;
  costPrice: number;
  salePrice: number;
  quantity: number;
  discount: number;
  total: number;
}

export interface DeliveryChallan {
  id: string;
  challanNo: string;
  salesOrderId: string;
  salesOrder: SalesOrder;
  customerId: string;
  customer: Customer;
  challanDate: string;
  deliveryDate?: string;
  status: 'PENDING' | 'DELIVERED' | 'INVOICED' | 'CANCELLED';
  driverName?: string;
  vehicleNo?: string;
  transportMode?: string;
  totalQty: number;
  totalAmount: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  salesOrderId?: string;
  deliveryChallanId?: string;
  customerId: string;
  customer: Customer;
  invoiceDate: string;
  dueDate?: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
}

// Customer API
export const customerApi = {
  getAll: (search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchApi<{ status: boolean; data: Customer[] }>(`/sales/customers${query}`);
  },
  getById: (id: string) => fetchApi<{ status: boolean; data: Customer }>(`/sales/customers/${id}`),
  create: (data: Partial<Customer>) => fetchApi<{ status: boolean; data: Customer }>('/sales/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<Customer>) => fetchApi<{ status: boolean; data: Customer }>(`/sales/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<{ status: boolean; message: string }>(`/sales/customers/${id}`, {
    method: 'DELETE',
  }),
  getBalance: (id: string) => fetchApi<{ status: boolean; data: any }>(`/sales/customers/${id}/balance`),
};

// Sales Order API
export const salesOrderApi = {
  getAll: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi<{ status: boolean; data: SalesOrder[] }>(`/sales/orders${query}`);
  },
  getAvailableForDelivery: () => fetchApi<{ status: boolean; data: SalesOrder[] }>('/sales/orders/available-for-delivery'),
  getById: (id: string) => fetchApi<{ status: boolean; data: SalesOrder }>(`/sales/orders/${id}`),
  create: (data: any) => fetchApi<{ status: boolean; data: SalesOrder }>('/sales/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => fetchApi<{ status: boolean; data: SalesOrder }>(`/sales/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  confirm: (id: string) => fetchApi<{ status: boolean; data: SalesOrder }>(`/sales/orders/${id}/confirm`, {
    method: 'POST',
  }),
  cancel: (id: string) => fetchApi<{ status: boolean; data: SalesOrder }>(`/sales/orders/${id}/cancel`, {
    method: 'POST',
  }),
  createDeliveryChallan: (id: string, data: any) => fetchApi<{ status: boolean; data: DeliveryChallan }>(`/sales/orders/${id}/delivery-challan`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Delivery Challan API
export const deliveryChallanApi = {
  getAll: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi<{ status: boolean; data: DeliveryChallan[] }>(`/sales/delivery-challans${query}`);
  },
  getById: (id: string) => fetchApi<{ status: boolean; data: DeliveryChallan }>(`/sales/delivery-challans/${id}`),
  create: (data: any) => fetchApi<{ status: boolean; data: DeliveryChallan }>('/sales/delivery-challans', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  markDelivered: (id: string) => fetchApi<{ status: boolean; data: DeliveryChallan }>(`/sales/delivery-challans/${id}/deliver`, {
    method: 'POST',
  }),
  cancel: (id: string) => fetchApi<{ status: boolean; data: DeliveryChallan }>(`/sales/delivery-challans/${id}/cancel`, {
    method: 'POST',
  }),
  createInvoice: (id: string, data: any) => fetchApi<{ status: boolean; data: SalesInvoice }>(`/sales/delivery-challans/${id}/invoice`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Sales Invoice API
export const salesInvoiceApi = {
  getAll: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi<{ status: boolean; data: SalesInvoice[] }>(`/sales/invoices${query}`);
  },
  getById: (id: string) => fetchApi<{ status: boolean; data: SalesInvoice }>(`/sales/invoices/${id}`),
  create: (data: any) => fetchApi<{ status: boolean; data: SalesInvoice }>('/sales/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  post: (id: string) => fetchApi<{ status: boolean; data: SalesInvoice }>(`/sales/invoices/${id}/post`, {
    method: 'POST',
  }),
  cancel: (id: string) => fetchApi<{ status: boolean; data: SalesInvoice }>(`/sales/invoices/${id}/cancel`, {
    method: 'POST',
  }),
  downloadPdf: (id: string) => fetchApi<Blob>(`/sales/invoices/${id}/pdf`, {
    method: 'GET',
    headers: { 'Accept': 'application/pdf' },
  }),
  getSummary: () => fetchApi<{ status: boolean; data: any }>('/sales/invoices/summary'),
};