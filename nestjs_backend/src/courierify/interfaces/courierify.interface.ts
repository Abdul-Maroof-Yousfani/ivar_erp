export interface CourierifyCustomer {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  correctedAddress?: string;
  correctedCity?: string;
}

export interface CourierifyAdvancePayment {
  amount: number;
  method?: string;
  reference?: string;
  collectedAt?: string;
}

export interface CourierifyMoney {
  currency: string;
  total: number;
  subtotal: number;
  discountTotal: number;
  codToCollect: number;
  advance?: CourierifyAdvancePayment;
}

export interface CourierifyPayment {
  financialStatus: string;
  method: string;
}

export interface CourierifyDiscountApplication {
  code: string;
  amount: number;
  type?: string;
  percentage?: number;
}

export interface CourierifyDiscounts {
  codes: string[];
  total: number;
  applications?: CourierifyDiscountApplication[];
}

export interface CourierifyOrderLineItem {
  title: string;
  variantTitle?: string;
  sku: string;
  quantity: number;
}

export interface CourierifyOrderItems {
  count: number;
  summary: string;
  lines: CourierifyOrderLineItem[];
}

export interface CourierifyOrderWorkflow {
  assignedTo?: string;
  attemptCount?: number;
  snoozedUntil?: string;
  mergeGroupId?: string;
}

export interface CourierifyOrderShipment {
  id: string;
  status: string;
  courierStatus?: string;
  courier: string;
  assignedCourier?: string;
  fulfilledVia?: string;
  trackingNumber?: string;
  codAmount: number;
  netAmount?: number;
  settled: boolean;
  returnReceived: boolean;
  returnReceivedAt?: string;
  deliveredAt?: string;
  bookedAt?: string;
}

export interface CourierifyOrder {
  id: string;
  orderId: string;
  orderName: string;
  orderedAt: string;
  stage: string;
  stageSource?: string;
  stageReason?: string;
  stagePinned?: boolean;
  flags?: string[];
  customer?: CourierifyCustomer;
  money: CourierifyMoney;
  payment?: CourierifyPayment;
  discounts?: CourierifyDiscounts;
  items?: CourierifyOrderItems;
  tags?: string[];
  source?: string;
  workflow?: CourierifyOrderWorkflow;
  shipment?: CourierifyOrderShipment;
  createdAt: string;
  updatedAt: string;
}

export interface CourierifyPagination {
  limit: number;
  count: number;
  hasMore: boolean;
  nextCursor?: string | null;
  filteredInPage?: number;
}

export interface CourierifyOrdersResponse {
  shop: string;
  shopCurrency: string;
  shopTimezone: string;
  orders: CourierifyOrder[];
  pagination: CourierifyPagination;
  timestamp: string;
}

export interface CourierifyShipment {
  id: string;
  orderId?: string;
  orderName?: string;
  trackingNumber: string;
  courier: string;
  assignedCourier?: string;
  status: string;
  courierStatus?: string;
  codAmount: number;
  netAmount?: number;
  settled: boolean;
  returnReceived: boolean;
  bookedAt?: string;
  deliveredAt?: string;
  returnReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourierifyShipmentsResponse {
  shop: string;
  shopCurrency: string;
  shipments: CourierifyShipment[];
  pagination: CourierifyPagination;
  timestamp: string;
}

export interface CourierifyReturn {
  id: string;
  shipmentId: string;
  orderName?: string;
  trackingNumber: string;
  courier: string;
  status: string;
  receivedAt?: string;
  items?: CourierifyOrderLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CourierifyReturnsResponse {
  shop: string;
  shopCurrency: string;
  returns: CourierifyReturn[];
  pagination: CourierifyPagination;
  timestamp: string;
}

export interface CourierifyReceiveReturnSinglePayload {
  trackingNumber?: string;
  shipmentId?: string;
  notes?: string;
  itemsReceived?: { sku: string; quantity: number }[];
}

export interface CourierifyReceiveReturnResult {
  success: boolean;
  trackingNumber?: string;
  shipmentId?: string;
  status?: string;
  receivedAt?: string;
  message?: string;
}

export interface CourierifySettlement {
  id: string;
  settlementNumber: string;
  courier: string;
  settledAt: string;
  totalCodCollected: number;
  totalCourierFees: number;
  netPaidAmount: number;
  parcelCount: number;
  currency: string;
  createdAt: string;
}

export interface CourierifySettlementsResponse {
  shop: string;
  shopCurrency: string;
  settlements: CourierifySettlement[];
  pagination: CourierifyPagination;
  timestamp: string;
}

export interface CourierifyReceivablesResponse {
  shop: string;
  shopCurrency: string;
  outstandingCodAmount: number;
  pendingParcelCount: number;
  byCourier?: Record<string, { codAmount: number; parcelCount: number }>;
  timestamp: string;
}

export interface CourierifyInventrifyReturnRow {
  sku: string;
  title?: string;
  variantTitle?: string;
  unitsShipped: number;
  unitsReturned: number;
  returnRatePercentage: number;
}

export interface CourierifyInventrifyReturnsResponse {
  shop: string;
  currency: string;
  items: CourierifyInventrifyReturnRow[];
  pagination: CourierifyPagination;
  timestamp: string;
}

export interface CourierifyInventrifyReturnRatesResponse {
  shop: string;
  rates: Record<string, number>;
  timestamp: string;
}

export interface CourierifyInventrifyStatusSummaryResponse {
  shop: string;
  summary: Record<string, { booked: number; inTransit: number; delivered: number; returned: number }>;
  timestamp: string;
}

export interface CourierifyNetworkLookupResponse {
  phone: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  score?: number;
  totalOrdersCount?: number;
  deliveredCount?: number;
  refusedCount?: number;
  returnPercentage?: number;
  recommendation?: string;
  timestamp: string;
}

export interface CourierifyDeliveryAnalyticsResponse {
  shop: string;
  period?: string;
  totalParcels: number;
  deliveredCount: number;
  returnedCount: number;
  inTransitCount: number;
  deliverySuccessRate: number;
  avgDeliveryTimeDays?: number;
  timestamp: string;
}

export interface CourierifyWebhookEnvelope<T = any> {
  eventId: string;
  topic: string;
  occurredAt: string;
  shopId: string;
  data: T;
}

export interface CourierifyVerifyResponse {
  valid: boolean;
  shop: string;
  shopCurrency: string;
  shopTimezone: string;
  scopes: string[];
  plan?: string;
  quotaRemaining?: number;
  timestamp: string;
}
