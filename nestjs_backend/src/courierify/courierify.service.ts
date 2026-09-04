import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { StockLedgerService } from '../warehouse/stock-ledger/stock-ledger.service';
import { FbrService } from '../pos-sales/fbr.service';
import { PosSalesService } from '../pos-sales/pos-sales.service';
import { MovementType, Prisma } from '@prisma/client';
import {
  CourierifyOrdersResponse,
  CourierifyOrder,
  CourierifyShipmentsResponse,
  CourierifyShipment,
  CourierifyReturnsResponse,
  CourierifySettlementsResponse,
  CourierifySettlement,
  CourierifyReceivablesResponse,
  CourierifyInventrifyReturnsResponse,
  CourierifyInventrifyReturnRatesResponse,
  CourierifyInventrifyStatusSummaryResponse,
  CourierifyNetworkLookupResponse,
  CourierifyDeliveryAnalyticsResponse,
  CourierifyWebhookEnvelope,
  CourierifyVerifyResponse,
} from './interfaces/courierify.interface';
import {
  ListOrdersQueryDto,
  ListShipmentsQueryDto,
  ShipmentActionDto,
  ReceiveReturnBatchDto,
  ReceiveReturnSingleDto,
  SettlementsQueryDto,
} from './dto/courierify.dto';

@Injectable()
export class CourierifyService {
  private readonly logger = new Logger(CourierifyService.name);

  private readonly baseUrl =
    process.env.COURIERIFY_BASE_URL ||
    'https://courierify.growzar.com/api/external';

  private readonly apiKey = process.env.COURIERIFY_API_KEY || '';
  private readonly webhookSecret = process.env.COURIERIFY_WEBHOOK_SECRET || '';

  // In-memory LRU-like set for deduplicating webhook events (up to 10,000 recent event IDs)
  private readonly processedEvents = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly fbrService: FbrService,
    private readonly posSalesService: PosSalesService,
  ) {}

  /**
   * Helper method to execute authenticated HTTP requests to Courierify API
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      params?: Record<string, any>;
      body?: any;
    } = {},
  ): Promise<T> {
    const { method = 'GET', params, body } = options;

    if (!this.apiKey) {
      this.logger.warn(
        'COURIERIFY_API_KEY is not set in environment configuration.',
      );
    }

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    this.logger.debug(`[Courierify API] ${method} ${url}`);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') || '60';
        this.logger.warn(
          `[Courierify API] Rate limited (429). Retry after ${retryAfter}s`,
        );
        throw new HttpException(
          {
            error: 'Rate limit exceeded on Courierify API',
            errorType: 'rate_limit_exceeded',
            retryAfter: parseInt(retryAfter, 10),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const json = await res.json();

      if (!res.ok) {
        this.logger.error(
          `[Courierify API Error ${res.status}]: ${JSON.stringify(json)}`,
        );
        throw new HttpException(
          json || { error: 'Courierify API Error', errorType: 'api_error' },
          res.status,
        );
      }

      return json as T;
    } catch (err: any) {
      if (err instanceof HttpException) throw err;

      this.logger.error(`[Courierify API Request Failed]: ${err.message}`, err.stack);
      throw new BadRequestException(
        `Failed to communicate with Courierify API: ${err.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  1. CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verify an API key and discover shop identity & quota
   */
  async verifyConnection(): Promise<CourierifyVerifyResponse> {
    return this.request<CourierifyVerifyResponse>('/verify');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  2. ORDERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List orders with keyset pagination and filters
   */
  async getOrders(
    query: ListOrdersQueryDto,
  ): Promise<CourierifyOrdersResponse> {
    return this.request<CourierifyOrdersResponse>('/orders', {
      params: query,
    });
  }

  /**
   * Get single order details by ID
   */
  async getOrder(id: string): Promise<CourierifyOrder> {
    return this.request<CourierifyOrder>(`/orders/${id}`);
  }

  /**
   * Get discount code usage and performance
   */
  async getDiscounts(): Promise<any> {
    return this.request<any>('/discounts');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  3. SHIPMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List shipments/parcels
   */
  async getShipments(
    query: ListShipmentsQueryDto,
  ): Promise<CourierifyShipmentsResponse> {
    return this.request<CourierifyShipmentsResponse>('/shipments', {
      params: query,
    });
  }

  /**
   * Get single shipment details by ID
   */
  async getShipment(id: string): Promise<CourierifyShipment> {
    return this.request<CourierifyShipment>(`/shipments/${id}`);
  }

  /**
   * Perform action on shipment (retry delivery, cancel, re-route)
   */
  async actOnShipment(id: string, dto: ShipmentActionDto): Promise<any> {
    return this.request<any>(`/shipments/${id}/actions`, {
      method: 'POST',
      body: dto,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  4. RETURNS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List returned parcels
   */
  async getReturns(
    query: ListShipmentsQueryDto,
  ): Promise<CourierifyReturnsResponse> {
    return this.request<CourierifyReturnsResponse>('/returns', {
      params: query,
    });
  }

  /**
   * Mark returned parcels as received in warehouse
   */
  async receiveReturns(
    dto: ReceiveReturnBatchDto | ReceiveReturnSingleDto,
  ): Promise<any> {
    return this.request<any>('/returns/receive', {
      method: 'POST',
      body: dto,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  5. SETTLEMENTS (FINANCIFY)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List courier payouts / settlements
   */
  async getSettlements(
    query: SettlementsQueryDto,
  ): Promise<CourierifySettlementsResponse> {
    return this.request<CourierifySettlementsResponse>(
      '/financify/settlements',
      {
        params: query,
      },
    );
  }

  /**
   * Get single payout detail
   */
  async getSettlement(id: string): Promise<CourierifySettlement> {
    return this.request<CourierifySettlement>(`/financify/settlements/${id}`);
  }

  /**
   * Get outstanding COD receivables
   */
  async getReceivables(): Promise<CourierifyReceivablesResponse> {
    return this.request<CourierifyReceivablesResponse>(
      '/financify/receivables',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  6. INVENTORY (INVENTRIFY)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List received returns by line item / SKU
   */
  async getInventrifyReturns(
    query: ListOrdersQueryDto,
  ): Promise<CourierifyInventrifyReturnsResponse> {
    return this.request<CourierifyInventrifyReturnsResponse>(
      '/inventrify/returns',
      { params: query },
    );
  }

  /**
   * Get return rate percentage per SKU
   */
  async getReturnRates(): Promise<CourierifyInventrifyReturnRatesResponse> {
    return this.request<CourierifyInventrifyReturnRatesResponse>(
      '/inventrify/return-rates',
    );
  }

  /**
   * Get units by delivery status per SKU
   */
  async getStatusSummary(): Promise<CourierifyInventrifyStatusSummaryResponse> {
    return this.request<CourierifyInventrifyStatusSummaryResponse>(
      '/inventrify/status-summary',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  7. CUSTOMER NETWORK & ANALYTICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Lookup cross-merchant COD risk score for a customer phone number
   */
  async lookupCustomerNetwork(
    phone: string,
  ): Promise<CourierifyNetworkLookupResponse> {
    return this.request<CourierifyNetworkLookupResponse>('/network/lookup', {
      params: { phone },
    });
  }

  /**
   * Get aggregated delivery performance analytics
   */
  async getDeliveryAnalytics(): Promise<CourierifyDeliveryAnalyticsResponse> {
    return this.request<CourierifyDeliveryAnalyticsResponse>('/delivery');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  8. WEBHOOK VERIFICATION & EVENT HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verify HMAC-SHA256 signature for incoming webhooks
   * Signature format: sha256=<hex> — HMAC of `${timestamp}.${rawBody}`
   */
  verifyWebhookSignature(
    signature: string | undefined,
    timestampStr: string | undefined,
    rawBody: string | Buffer,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'COURIERIFY_WEBHOOK_SECRET is not configured. Webhook verification failed.',
      );
      return false;
    }

    if (!signature || !timestampStr) {
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Check if timestamp is older than 5 minutes (300,000 ms) to defeat replay attacks
    const now = Date.now();
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
      this.logger.warn(
        `Webhook timestamp expired or out of bounds: diff=${Math.abs(now - timestamp)}ms`,
      );
      return false;
    }

    const bodyString =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    const expectedHex = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestampStr}.${bodyString}`)
      .digest('hex');

    const expectedSignature = `sha256=${expectedHex}`;

    try {
      const expectedBuf = Buffer.from(expectedSignature);
      const actualBuf = Buffer.from(signature);

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch (e) {
      this.logger.error('Error comparing signature timingSafeEqual', e);
      return false;
    }
  }

  /**
   * Asynchronously process verified webhook envelope
   */
  async handleWebhook(envelope: CourierifyWebhookEnvelope): Promise<void> {
    const { eventId, topic, data, occurredAt } = envelope;

    // Deduplicate eventId
    if (this.processedEvents.has(eventId)) {
      this.logger.log(`[Courierify Webhook] Duplicate eventId ignored: ${eventId}`);
      return;
    }

    // Keep set size bounded (max 10,000 items)
    if (this.processedEvents.size > 10000) {
      const firstKey = this.processedEvents.values().next().value;
      if (firstKey) this.processedEvents.delete(firstKey);
    }
    this.processedEvents.add(eventId);

    this.logger.log(
      `[Courierify Webhook] Processing event topic: "${topic}" (Id: ${eventId}, OccurredAt: ${occurredAt})`,
    );

    try {
      switch (topic) {
        case 'order.created':
        case 'order.placed':
        case 'order.updated':
          await this.processOmsOrderToPos(data, occurredAt);
          break;
        case 'shipment.booked':
          await this.onShipmentBooked(data, occurredAt);
          break;
        case 'shipment.status_changed':
          await this.onShipmentStatusChanged(data);
          break;
        case 'shipment.delivered':
          await this.onShipmentDelivered(data);
          break;
        case 'return.received':
          await this.onReturnReceived(data);
          break;
        case 'settlement.received':
          await this.onSettlementReceived(data);
          break;
        default:
          this.logger.log(`[Courierify Webhook] Unhandled topic: ${topic}`);
          if (topic && (topic.includes('order') || topic.includes('shipment'))) {
            await this.processOmsOrderToPos(data, occurredAt);
          }
      }
    } catch (error: any) {
      this.logger.error(
        `[Courierify Webhook Error] Failed to process event ${eventId} (${topic}): ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process incoming Courierify / OMS Order into IVAR POS:
   * 1. Location: OMS-IV (code: OMS-IV)
   * 2. Source Warehouse: Warehouse-IV (code: WH-KHI)
   * 3. Auto-creates Customer if not existing
   * 4. Calculates WOST (Without Sales Tax) discounts and taxes
   * 5. Generates STN (TransferRequest) from WH-KHI to OMS-IV with remarks, auto-accepted
   * 6. Generates full POS SalesOrder at OMS-IV with original order date & time, payment status, and cashmemo notes
   * 7. Calls FBR API (if OMS-IV has FBR enabled)
   */
  async processOmsOrderToPos(
    rawOrderData: any,
    occurredAt?: string,
  ): Promise<any> {
    let orderData = rawOrderData || {};
    const orderId = orderData.orderId || orderData.id;
    const orderName = orderData.orderName || orderData.orderNumber || orderId;

    if (!orderName && !orderId) {
      this.logger.warn(
        '[Courierify POS] Order payload missing orderName/orderId. Skipping creation.',
      );
      return null;
    }

    const primaryRef = String(orderName || orderId);

    // 1. Idempotency Check: Don't duplicate existing orders
    const existingOrder = await this.prisma.salesOrder.findFirst({
      where: {
        OR: [
          { referenceNumber: primaryRef },
          { orderNumber: primaryRef },
          ...(orderId ? [{ referenceNumber: String(orderId) }] : []),
        ],
      },
    });

    const courierName =
      orderData.shipment?.courier || orderData.courier || 'Courier';
    const trackingNo =
      orderData.shipment?.trackingNumber ||
      orderData.trackingNumber ||
      'Pending';

    if (existingOrder) {
      this.logger.log(
        `[Courierify POS] Order ${primaryRef} already exists (#${existingOrder.orderNumber}). Updating shipping details.`,
      );
      if (courierName || trackingNo) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: {
            notes: existingOrder.notes
              ? `${existingOrder.notes} | Courier: ${courierName}, Tracking: ${trackingNo}`
              : `Courier: ${courierName}, Tracking: ${trackingNo}`,
          },
        });
      }
      return existingOrder;
    }

    // 2. If line items are missing from webhook payload, fetch full order from Courierify API
    if (
      !orderData.items?.lines ||
      !Array.isArray(orderData.items.lines) ||
      orderData.items.lines.length === 0
    ) {
      try {
        const fetchedOrder = await this.getOrder(orderId || orderName);
        if (fetchedOrder) {
          orderData = { ...fetchedOrder, ...orderData };
          if (fetchedOrder.items?.lines) orderData.items = fetchedOrder.items;
          if (fetchedOrder.customer)
            orderData.customer = {
              ...fetchedOrder.customer,
              ...orderData.customer,
            };
          if (fetchedOrder.money)
            orderData.money = { ...fetchedOrder.money, ...orderData.money };
        }
      } catch (err: any) {
        this.logger.warn(
          `[Courierify POS] Could not fetch order ${primaryRef} from API: ${err.message}`,
        );
      }
    }

    // 3. Resolve Target Location: OMS-IV
    let omsLocation = await this.prisma.location.findFirst({
      where: {
        OR: [
          { code: 'OMS-IV' },
          { code: { contains: 'OMS-IV', mode: 'insensitive' } },
          { shortCode: { equals: 'OMS-IV', mode: 'insensitive' } },
          { name: { contains: 'OMS-IV', mode: 'insensitive' } },
        ],
        isDeleted: false,
      },
    });

    if (!omsLocation) {
      omsLocation = await this.prisma.location.findFirst({
        where: { isOnline: true, isDeleted: false },
      });
    }

    if (!omsLocation) {
      this.logger.error(
        `[Courierify POS] Target location OMS-IV not found! Cannot process order ${primaryRef}`,
      );
      return null;
    }

    // 4. Resolve Source Warehouse: Warehouse-IV (WH-KHI)
    let warehouseKhi = await this.prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: 'WH-KHI' },
          { code: { contains: 'WH-KHI', mode: 'insensitive' } },
          { name: { contains: 'Warehouse-IV', mode: 'insensitive' } },
          { name: { contains: 'WH-KHI', mode: 'insensitive' } },
        ],
        isDeleted: false,
      },
    });

    if (!warehouseKhi) {
      if (omsLocation.warehouseId) {
        warehouseKhi = await this.prisma.warehouse.findUnique({
          where: { id: omsLocation.warehouseId },
        });
      }
      if (!warehouseKhi) {
        warehouseKhi = await this.prisma.warehouse.findFirst({
          where: { isActive: true, isDeleted: false },
        });
      }
    }

    if (!warehouseKhi) {
      this.logger.error(
        `[Courierify POS] Source warehouse WH-KHI not found! Cannot process order ${primaryRef}`,
      );
      return null;
    }

    // 5. Customer Resolution & Auto-Creation
    const cust = orderData.customer || {};
    const customerName = cust.name || 'Online Customer';
    const customerPhone = cust.phone ? String(cust.phone).trim() : undefined;
    const customerEmail = cust.email ? String(cust.email).trim() : undefined;
    const addressPart = cust.correctedAddress || cust.address || '';
    const cityPart = cust.correctedCity || cust.city || '';
    const fullAddress = [addressPart, cityPart].filter(Boolean).join(', ');

    let customerId: string | null = null;
    if (customerPhone || customerEmail) {
      const existingCust = await this.prisma.customer.findFirst({
        where: {
          OR: [
            ...(customerPhone ? [{ contactNo: customerPhone }] : []),
            ...(customerEmail ? [{ email: customerEmail }] : []),
          ],
        },
        select: { id: true },
      });
      if (existingCust) customerId = existingCust.id;
    }

    if (!customerId) {
      const custCode = `CUST-ONL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      try {
        const createdCustomer = await this.prisma.customer.create({
          data: {
            code: custCode,
            name: customerName,
            contactNo: customerPhone,
            email: customerEmail,
            address: fullAddress || undefined,
            customerType: 'POS',
          },
          select: { id: true },
        });
        customerId = createdCustomer.id;
        this.logger.log(
          `[Courierify POS] Created new customer: ${customerName} (${custCode})`,
        );
      } catch (err: any) {
        this.logger.warn(
          `[Courierify POS] Failed to create customer: ${err.message}`,
        );
      }
    }

    // 6. Match Line Items & Calculate WOST (Without Sales Tax) Math
    const rawLines: Array<{
      sku: string;
      quantity: number;
      title?: string;
      unitPrice?: number;
    }> = orderData.items?.lines || [];

    if (rawLines.length === 0) {
      this.logger.warn(
        `[Courierify POS] Order ${primaryRef} has no line items. Skipping creation.`,
      );
      return null;
    }

    const skus = rawLines.map((l) => (l.sku || '').trim()).filter(Boolean);
    const matchedItems = await this.prisma.item.findMany({
      where: {
        isActive: true,
        OR: [
          { sku: { in: skus, mode: 'insensitive' } },
          { barCode: { in: skus, mode: 'insensitive' } },
          { itemId: { in: skus, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        itemId: true,
        sku: true,
        barCode: true,
        description: true,
        unitPrice: true,
        unitCost: true,
        taxRate1: true,
        hsCodeStr: true,
        hsCode: { select: { hsCode: true } },
      },
    });

    const itemLookup = new Map<string, any>();
    for (const it of matchedItems) {
      if (it.sku) itemLookup.set(it.sku.toLowerCase().trim(), it);
      if (it.barCode) itemLookup.set(it.barCode.toLowerCase().trim(), it);
      if (it.itemId) itemLookup.set(it.itemId.toLowerCase().trim(), it);
    }

    const totalDiscountGross = Number(
      orderData.money?.discountTotal || orderData.discounts?.total || 0,
    );

    let totalGross = 0;
    const resolvedLines: Array<{
      item: any;
      qty: number;
      retailPrice: number;
      taxRate: number;
      taxDivisor: number;
      lineGross: number;
    }> = [];

    for (const line of rawLines) {
      const skuKey = (line.sku || '').toLowerCase().trim();
      let matched = itemLookup.get(skuKey);

      if (!matched) {
        const fallbackSku = line.sku || `ONL-${Date.now()}`;
        matched = await this.prisma.item.create({
          data: {
            itemId: fallbackSku,
            sku: fallbackSku,
            barCode: line.sku,
            description: line.title || `Online Item ${fallbackSku}`,
            unitPrice: line.unitPrice || 0,
            unitCost: 0,
            taxRate1: 18,
          },
          select: {
            id: true,
            itemId: true,
            sku: true,
            barCode: true,
            description: true,
            unitPrice: true,
            unitCost: true,
            taxRate1: true,
            hsCodeStr: true,
            hsCode: { select: { hsCode: true } },
          },
        });
        itemLookup.set(skuKey, matched);
      }

      const qty = Number(line.quantity) || 1;
      const retailPrice = Number(line.unitPrice ?? matched.unitPrice ?? 0);
      const taxRate = Number(matched.taxRate1 || 18);
      const taxDivisor = 1 + taxRate / 100;
      const lineGross = retailPrice * qty;

      totalGross += lineGross;
      resolvedLines.push({
        item: matched,
        qty,
        retailPrice,
        taxRate,
        taxDivisor,
        lineGross,
      });
    }

    // Convert values to WOST and apply discount on WOST
    let orderSubtotalWOST = 0;
    let orderDiscountWOST = 0;
    let orderTaxAmount = 0;
    let orderGrandTotal = 0;

    const orderItemsData: Array<{
      itemId: string;
      quantity: number;
      unitPrice: number;
      discountPercent: number;
      discountAmount: number;
      taxPercent: number;
      taxAmount: number;
      lineTotal: number;
      sku: string;
      description: string;
      hsCode: string | null;
    }> = [];

    for (const line of resolvedLines) {
      const shareOfGrossDiscount =
        totalGross > 0
          ? Math.round(
              (line.lineGross / totalGross) * totalDiscountGross * 100,
            ) / 100
          : 0;

      // WOST = Retail / (1 + Tax%)
      const wostPerUnit = line.retailPrice / line.taxDivisor;
      const lineTotalWOST = Math.round(wostPerUnit * line.qty * 100) / 100;

      // Discount on WOST = Gross Discount / (1 + Tax%)
      const lineDiscountWOST =
        Math.round((shareOfGrossDiscount / line.taxDivisor) * 100) / 100;
      const afterDiscWOST = Math.max(0, lineTotalWOST - lineDiscountWOST);

      // Tax on amount after discount
      const lineTaxAmt =
        Math.round(afterDiscWOST * (line.taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((afterDiscWOST + lineTaxAmt) * 100) / 100;

      const discPct =
        lineTotalWOST > 0
          ? Math.round((lineDiscountWOST / lineTotalWOST) * 100 * 100) / 100
          : 0;

      orderSubtotalWOST += lineTotalWOST;
      orderDiscountWOST += lineDiscountWOST;
      orderTaxAmount += lineTaxAmt;
      orderGrandTotal += lineTotal;

      orderItemsData.push({
        itemId: line.item.id,
        quantity: line.qty,
        unitPrice: line.retailPrice,
        discountPercent: discPct,
        discountAmount: lineDiscountWOST,
        taxPercent: line.taxRate,
        taxAmount: lineTaxAmt,
        lineTotal,
        sku: line.item.sku,
        description: line.item.description || 'Item',
        hsCode: line.item.hsCode?.hsCode || line.item.hsCodeStr || null,
      });
    }

    // 7. Transaction: STN Creation & Auto-Acceptance + POS Order Creation
    const rawFinancialStatus = String(
      orderData.payment?.financialStatus || '',
    ).toLowerCase();
    const isPaid = rawFinancialStatus === 'paid';
    const paymentStatus = isPaid ? 'paid' : 'unpaid';
    const rawPaymentMethod = String(
      orderData.payment?.method || 'COD',
    ).toUpperCase();

    const codAmount =
      orderData.money?.codToCollect ?? (isPaid ? 0 : orderGrandTotal);
    const advanceAmount = orderData.money?.advance?.amount || 0;

    const cashMemoNotes = [
      `Online Order: #${primaryRef}`,
      `Customer: ${customerName} (${customerPhone || 'N/A'})`,
      `City: ${cityPart || 'N/A'}`,
      `Address: ${fullAddress || 'N/A'}`,
      `Courier: ${courierName}`,
      `Tracking: ${trackingNo}`,
      `Payment: ${rawPaymentMethod} (${paymentStatus.toUpperCase()})`,
      `COD to Collect: Rs. ${codAmount}`,
      advanceAmount > 0 ? `Advance Paid: Rs. ${advanceAmount}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const orderDateRaw =
      orderData.orderedAt || orderData.createdAt || occurredAt;
    const orderDate = orderDateRaw ? new Date(orderDateRaw) : new Date();
    const validOrderDate = !isNaN(orderDate.getTime()) ? orderDate : new Date();

    const createdResult = await this.prisma.$transaction(
      async (tx) => {
        // A. Generate STN (Transfer Request)
        const trCount = await tx.transferRequest.count();
        let trSeq = trCount + 1;
        let requestNo = `TR-${String(trSeq).padStart(6, '0')}`;
        while (
          await tx.transferRequest.findUnique({
            where: { requestNo },
            select: { id: true },
          })
        ) {
          trSeq++;
          requestNo = `TR-${String(trSeq).padStart(6, '0')}`;
        }

        const stnRemarks = `STN for Online OMS Order #${primaryRef} (${customerName}) | Courier: ${courierName} | Tracking: ${trackingNo}`;

        const stn = await tx.transferRequest.create({
          data: {
            requestNo,
            fromWarehouseId: warehouseKhi.id,
            toLocationId: omsLocation.id,
            transferType: 'WAREHOUSE_TO_OUTLET',
            status: 'COMPLETED',
            notes: stnRemarks,
            items: {
              create: orderItemsData.map((it) => ({
                itemId: it.itemId,
                quantity: new Prisma.Decimal(it.quantity),
                fulfilledQty: new Prisma.Decimal(it.quantity),
              })),
            },
          },
        });

        // B. Auto-accept STN stock movements: WH-KHI (OUTBOUND) -> OMS-IV (INBOUND)
        for (const it of orderItemsData) {
          // WH-KHI Outbound
          await this.stockLedgerService.createEntry(
            {
              itemId: it.itemId,
              warehouseId: warehouseKhi.id,
              qty: -it.quantity,
              movementType: MovementType.OUTBOUND,
              referenceType: 'TRANSFER_REQUEST',
              referenceId: stn.id,
              allowNegativeStock: true,
            },
            tx,
          );

          const whStock = await tx.inventoryItem.findFirst({
            where: {
              itemId: it.itemId,
              warehouseId: warehouseKhi.id,
              locationId: null,
              status: 'AVAILABLE',
            },
          });
          if (whStock) {
            await tx.inventoryItem.update({
              where: { id: whStock.id },
              data: { quantity: { decrement: it.quantity } },
            });
          } else {
            await tx.inventoryItem.create({
              data: {
                itemId: it.itemId,
                warehouseId: warehouseKhi.id,
                locationId: null,
                quantity: -it.quantity,
                status: 'AVAILABLE',
              },
            });
          }

          // OMS-IV Inbound
          await this.stockLedgerService.createEntry(
            {
              itemId: it.itemId,
              warehouseId: warehouseKhi.id,
              locationId: omsLocation.id,
              qty: it.quantity,
              movementType: MovementType.INBOUND,
              referenceType: 'TRANSFER_REQUEST',
              referenceId: stn.id,
              allowNegativeStock: true,
            },
            tx,
          );

          const omsStock = await tx.inventoryItem.findFirst({
            where: {
              itemId: it.itemId,
              locationId: omsLocation.id,
              status: 'AVAILABLE',
            },
          });
          if (omsStock) {
            await tx.inventoryItem.update({
              where: { id: omsStock.id },
              data: { quantity: { increment: it.quantity } },
            });
          } else {
            await tx.inventoryItem.create({
              data: {
                itemId: it.itemId,
                warehouseId: warehouseKhi.id,
                locationId: omsLocation.id,
                quantity: it.quantity,
                status: 'AVAILABLE',
              },
            });
          }
        }

        // C. Generate POS Order Number
        const orderNumber = await this.posSalesService.generateOrderNumber(
          omsLocation.id,
          tx,
        );

        // D. Create POS SalesOrder
        const finalNotes = `${cashMemoNotes} | STN: ${stn.requestNo}`;

        const posOrder = await tx.salesOrder.create({
          data: {
            orderNumber,
            referenceNumber: primaryRef,
            locationId: omsLocation.id,
            customerId,
            paymentMethod: rawPaymentMethod,
            paymentStatus,
            status: 'completed',
            notes: finalNotes,
            subtotal: new Prisma.Decimal(orderSubtotalWOST),
            discountAmount: new Prisma.Decimal(orderDiscountWOST),
            taxAmount: new Prisma.Decimal(orderTaxAmount),
            grandTotal: new Prisma.Decimal(orderGrandTotal),
            createdAt: validOrderDate,
            items: {
              create: orderItemsData.map((it) => ({
                itemId: it.itemId,
                quantity: it.quantity,
                unitPrice: new Prisma.Decimal(it.unitPrice),
                discountPercent: new Prisma.Decimal(it.discountPercent),
                discountAmount: new Prisma.Decimal(it.discountAmount),
                taxPercent: new Prisma.Decimal(it.taxPercent),
                taxAmount: new Prisma.Decimal(it.taxAmount),
                lineTotal: new Prisma.Decimal(it.lineTotal),
              })),
            },
          },
        });

        // E. Deduct POS Sale from OMS-IV (Balances the inbound STN)
        for (const it of orderItemsData) {
          await this.stockLedgerService.createEntry(
            {
              itemId: it.itemId,
              warehouseId: warehouseKhi.id,
              locationId: omsLocation.id,
              qty: -it.quantity,
              movementType: MovementType.OUTBOUND,
              referenceType: 'POS_SALE',
              referenceId: posOrder.id,
              allowNegativeStock: true,
            },
            tx,
          );

          const currentOmsStock = await tx.inventoryItem.findFirst({
            where: {
              itemId: it.itemId,
              locationId: omsLocation.id,
              status: 'AVAILABLE',
            },
          });
          if (currentOmsStock) {
            await tx.inventoryItem.update({
              where: { id: currentOmsStock.id },
              data: { quantity: { decrement: it.quantity } },
            });
          }
        }

        return { posOrder, stn };
      },
      {
        maxWait: 20000,
        timeout: 60000,
      },
    );

    this.logger.log(
      `[Courierify POS] Created POS Order #${createdResult.posOrder.orderNumber} (STN #${createdResult.stn.requestNo}) for OMS Order #${primaryRef}`,
    );

    // 8. FBR Sync (Non-blocking)
    if (
      omsLocation.fbrEnabled &&
      omsLocation.fbrBposId &&
      omsLocation.fbrBearerToken
    ) {
      try {
        const fbrItems = orderItemsData.map((it) => ({
          itemId: it.itemId,
          sku: it.sku,
          description: it.description,
          hsCode: it.hsCode,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxPercent: it.taxPercent,
          discountAmount: it.discountAmount,
          taxAmount: it.taxAmount,
          lineTotal: it.lineTotal,
        }));

        const fbrPayload = this.fbrService.buildPayload({
          posId: omsLocation.fbrBposId,
          usin: createdResult.posOrder.orderNumber,
          orderDate: validOrderDate,
          buyerName: customerName,
          buyerPhone: customerPhone || null,
          paymentMode: isPaid ? 2 : 1,
          invoiceType: 1,
          items: fbrItems,
        });

        const fbrRes = await this.fbrService.postInvoice(
          fbrPayload,
          undefined,
          omsLocation.fbrBearerToken,
        );

        const invNum = fbrRes.FBRInvoiceNumber
          ? String(fbrRes.FBRInvoiceNumber)
          : fbrRes.InvoiceNumber;

        await this.prisma.salesOrder.update({
          where: { id: createdResult.posOrder.id },
          data: {
            fbrInvoiceNumber: invNum || undefined,
            fbrQrCode: fbrRes.QRCode || undefined,
            fbrStatus: invNum ? 'SYNCED' : 'PENDING',
          },
        });
        this.logger.log(
          `[Courierify POS] FBR synced for #${createdResult.posOrder.orderNumber}: Invoice ${invNum}`,
        );
      } catch (fbrErr: any) {
        this.logger.error(
          `[Courierify POS] FBR sync failed for #${createdResult.posOrder.orderNumber}: ${fbrErr.message}`,
        );
        await this.prisma.salesOrder.update({
          where: { id: createdResult.posOrder.id },
          data: { fbrStatus: 'FAILED' },
        });
      }
    }

    return createdResult.posOrder;
  }

  private async onShipmentBooked(
    data: any,
    occurredAt?: string,
  ): Promise<void> {
    const { orderName, orderId, trackingNumber, courier } = data || {};
    this.logger.log(
      `[Shipment Booked] Order: ${orderName || orderId}, Tracking: ${trackingNumber}, Courier: ${courier}`,
    );

    if (orderName || orderId) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: orderName || orderId },
            { referenceNumber: orderId || orderName },
          ],
        },
      });

      if (existingOrder) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: 'booked',
            notes: existingOrder.notes
              ? `${existingOrder.notes} | Courier: ${courier}, Tracking: ${trackingNumber}`
              : `Courier: ${courier}, Tracking: ${trackingNumber}`,
          },
        });
        this.logger.log(
          `[Courierify] Updated local order #${existingOrder.orderNumber} to status=booked`,
        );
      } else {
        // If order does not exist yet when shipment.booked arrives, create full POS order and STN
        await this.processOmsOrderToPos(data, occurredAt);
      }
    }
  }

  private async onShipmentStatusChanged(data: any): Promise<void> {
    const { trackingNumber, status, courierStatus, orderName } = data || {};
    this.logger.log(
      `[Shipment Status Changed] Tracking: ${trackingNumber}, Status: ${status} (${courierStatus})`,
    );

    if (orderName) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: orderName },
            { referenceNumber: orderName },
          ],
        },
      });

      if (existingOrder) {
        const updateData: any = {
          status: status?.toLowerCase() || existingOrder.status,
        };
        if (status?.toLowerCase() === 'delivered') {
          updateData.paymentStatus = 'paid';
        }
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: updateData,
        });
      }
    }
  }

  private async onShipmentDelivered(data: any): Promise<void> {
    const { trackingNumber, orderName, deliveredAt, codAmount } = data || {};
    this.logger.log(
      `[Shipment Delivered] Order: ${orderName}, Tracking: ${trackingNumber}, COD: ${codAmount}`,
    );

    if (orderName) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: orderName },
            { referenceNumber: orderName },
          ],
        },
      });

      if (existingOrder) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: 'delivered',
            paymentStatus: 'paid',
          },
        });
        this.logger.log(
          `[Courierify] Marked order #${existingOrder.orderNumber} as delivered and paid`,
        );
      }
    }
  }

  private async onReturnReceived(data: any): Promise<void> {
    const { trackingNumber, orderName, receivedAt } = data || {};
    this.logger.log(
      `[Return Received] Order: ${orderName}, Tracking: ${trackingNumber}, ReceivedAt: ${receivedAt}`,
    );

    if (orderName) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: orderName },
            { referenceNumber: orderName },
          ],
        },
      });

      if (existingOrder) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: 'returned',
          },
        });
        this.logger.log(
          `[Courierify] Marked order #${existingOrder.orderNumber} as returned`,
        );
      }
    }
  }

  private async onSettlementReceived(data: any): Promise<void> {
    const { settlementNumber, courier, netPaidAmount, parcelCount } = data || {};
    this.logger.log(
      `[Settlement Received] #${settlementNumber} from ${courier}: Net Paid = ${netPaidAmount} for ${parcelCount} parcels`,
    );
  }
}
