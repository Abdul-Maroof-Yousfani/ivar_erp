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
import { ShopifyService } from '../shopify/shopify.service';
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
    private readonly shopifyService: ShopifyService,
  ) { }

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
          // On order.created/placed, record order in POS as pending WITHOUT creating an STN yet
          await this.processOmsOrderToPos(data, occurredAt, { createStn: false });
          break;
        case 'shipment.booked':
          // On shipment.booked, generate Automatic Transfer Request (STN) and mark booked
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
        case 'order.cancelled':
        case 'order.canceled':
        case 'shipment.cancelled':
        case 'shipment.canceled':
          await this.onOrderCancelled(data);
          break;
        default:
          this.logger.log(`[Courierify Webhook] Unhandled topic: ${topic}`);
          if (topic && topic.includes('cancel')) {
            await this.onOrderCancelled(data);
          } else if (topic && topic.includes('return')) {
            await this.onReturnReceived(data);
          } else if (topic && topic.includes('shipment')) {
            await this.onShipmentBooked(data, occurredAt);
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
   * Helper to extract all discount/voucher codes from a payload
   */
  extractDiscountCodesFromPayload(orderData: any): string[] {
    const codes: string[] = [];
    if (!orderData) return codes;

    if (Array.isArray(orderData.discounts?.codes)) {
      for (const c of orderData.discounts.codes) {
        if (typeof c === 'string' && c.trim()) codes.push(c.trim().toUpperCase());
      }
    }
    if (Array.isArray(orderData.discounts?.applications)) {
      for (const app of orderData.discounts.applications) {
        const code = app?.code || app?.title;
        if (typeof code === 'string' && code.trim()) codes.push(code.trim().toUpperCase());
      }
    }
    if (Array.isArray(orderData.discountCodes)) {
      for (const c of orderData.discountCodes) {
        if (typeof c === 'string' && c.trim()) codes.push(c.trim().toUpperCase());
      }
    }
    if (typeof orderData.discounts?.code === 'string' && orderData.discounts.code.trim()) {
      codes.push(orderData.discounts.code.trim().toUpperCase());
    }

    return Array.from(new Set(codes));
  }

  /**
   * Helper to redeem voucher(s) in POS and delete/deactivate from Shopify
   */
  async redeemOrderVouchers(
    discountCodes: string[],
    posOrderId?: string,
    locationId?: string | null,
    discountAmount?: number,
    orderRef?: string,
  ): Promise<void> {
    if (!discountCodes || discountCodes.length === 0) return;

    const voucherPrefixRegex = /^(GFT|EXC|CRD|CRP|OGT|RFD|SHP)-/i;

    for (const rawCode of discountCodes) {
      const code = String(rawCode).trim().toUpperCase();
      if (!code) continue;

      try {
        const voucher = await this.prisma.voucher.findFirst({
          where: {
            code: { equals: code, mode: 'insensitive' },
            isDeleted: false,
          },
        });

        // SAFETY: If not found in POS database AND doesn't have a POS voucher prefix,
        // it is a general promotional/marketing discount (like IVAR10). NEVER touch or expire it!
        if (!voucher && !voucherPrefixRegex.test(code)) {
          this.logger.log(
            `[Courierify POS] Skipping discount "${code}": not a POS voucher (general promotional discount).`,
          );
          continue;
        }

        if (voucher) {
          const faceVal = Number(voucher.faceValue || 0);
          const usedAmt =
            discountAmount && discountAmount > 0
              ? Math.min(discountAmount, faceVal)
              : faceVal;

          // 1. Update Voucher status in POS: isRedeemed = true, isActive = false
          if (!voucher.isRedeemed || voucher.isActive) {
            await this.prisma.voucher.update({
              where: { id: voucher.id },
              data: {
                isRedeemed: true,
                isActive: false,
                shopifySyncStatus: 'REDEEMED_ONLINE',
                shopifySyncedAt: new Date(),
              },
            });
            this.logger.log(`[Courierify POS] Marked voucher ${code} as REDEEMED in POS`);
          }

          // 2. Create Audit Transaction in POS
          await this.prisma.voucherTransaction.create({
            data: {
              voucherId: voucher.id,
              orderId: posOrderId || undefined,
              locationId: locationId || undefined,
              action: 'REDEEMED_ONLINE',
              amountUsed: new Prisma.Decimal(usedAmt),
              notes: `Voucher redeemed online via order #${orderRef || posOrderId || 'OMS'}`,
            },
          }).catch((err) => {
            this.logger.warn(
              `[Courierify POS] Could not record voucher transaction for ${code}: ${err.message}`,
            );
          });

          // 3. Create Voucher Redemption link if posOrderId provided
          if (posOrderId) {
            const existingRedemption =
              await this.prisma.voucherRedemption.findUnique({
                where: {
                  voucherId_orderId: {
                    voucherId: voucher.id,
                    orderId: posOrderId,
                  },
                },
              });

            if (!existingRedemption) {
              await this.prisma.voucherRedemption.create({
                data: {
                  voucherId: voucher.id,
                  orderId: posOrderId,
                  amountUsed: new Prisma.Decimal(usedAmt),
                },
              }).catch((err) => {
                this.logger.warn(
                  `[Courierify POS] Could not record voucher redemption for ${code}: ${err.message}`,
                );
              });
            }
          }

          // 4. Mark PriceRule as Expired on Shopify (DO NOT DELETE)
          if (voucher.shopifyPriceRuleId) {
            this.logger.log(
              `[Courierify POS] Marking price rule ${voucher.shopifyPriceRuleId} as Expired on Shopify for voucher ${code}`,
            );
            await this.shopifyService.expirePriceRule(voucher.shopifyPriceRuleId);
          } else {
            this.logger.log(
              `[Courierify POS] Marking price rule by code ${code} as Expired on Shopify`,
            );
            await this.shopifyService.expirePriceRuleByCode(code);
          }
        } else if (voucherPrefixRegex.test(code)) {
          // Has valid POS voucher prefix (e.g. GFT-...) but not found in POS DB:
          this.logger.log(
            `[Courierify POS] Voucher ${code} has POS prefix but not in POS DB, attempting to expire on Shopify`,
          );
          await this.shopifyService.expirePriceRuleByCode(code);
        }
      } catch (err: any) {
        this.logger.error(
          `[Courierify POS] Error during voucher redemption for ${code}: ${err.message}`,
        );
      }
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
  /**
   * Helper to resolve OMS Location (defaults to OMS-IV / Online)
   */
  async resolveOmsLocation(locationId?: string): Promise<any> {
    if (locationId) {
      const loc = await this.prisma.location.findUnique({
        where: { id: locationId },
      });
      if (loc) return loc;
    }
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
    return omsLocation;
  }

  /**
   * Helper to resolve Source Warehouse WH-KHI (Warehouse-IV)
   */
  async resolveWarehouseKhi(omsLocation?: any): Promise<any> {
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

    if (!warehouseKhi && omsLocation?.warehouseId) {
      warehouseKhi = await this.prisma.warehouse.findUnique({
        where: { id: omsLocation.warehouseId },
      });
    }
    if (!warehouseKhi) {
      warehouseKhi = await this.prisma.warehouse.findFirst({
        where: { isActive: true, isDeleted: false },
      });
    }
    return warehouseKhi;
  }

  /**
   * Process incoming Courierify / OMS Order into IVAR POS:
   * 1. Location: OMS-IV (code: OMS-IV)
   * 2. Source Warehouse: Warehouse-IV (code: WH-KHI)
   * 3. Auto-creates Customer if not existing
   * 4. Calculates WOST (Without Sales Tax) discounts and taxes
   * 5. Generates STN (TransferRequest) from WH-KHI to OMS-IV with remarks, auto-accepted (only if options.createStn !== false)
   * 6. Generates full POS SalesOrder at OMS-IV with original order date & time, payment status, and cashmemo notes
   * 7. Calls FBR API (if OMS-IV has FBR enabled and order is booked)
   */
  async processOmsOrderToPos(
    rawOrderData: any,
    occurredAt?: string,
    options: { createStn?: boolean } = { createStn: true },
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
      include: { items: true },
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

      // If called with createStn: true (e.g. on shipment.booked) and order has no STN yet, create it!
      if (options.createStn !== false) {
        const existingStn = await this.prisma.transferRequest.findFirst({
          where: {
            transferType: 'WAREHOUSE_TO_OUTLET',
            OR: [
              { notes: { contains: `ref:${existingOrder.id}` } },
              { notes: { contains: `#${existingOrder.referenceNumber || existingOrder.orderNumber}` } },
              { notes: { contains: existingOrder.orderNumber } },
            ],
          },
        });
        if (!existingStn && !existingOrder.notes?.includes('STN: TR-')) {
          await this.createStnForExistingOrder(existingOrder, orderData);
        }
      }

      // Check if vouchers need to be redeemed
      const voucherPrefixRegex = /^(GFT|EXC|CRD|CRP|OGT|RFD|SHP)-/i;
      const discountCodes = this.extractDiscountCodesFromPayload(orderData).filter(
        (c) => voucherPrefixRegex.test(c),
      );
      if (discountCodes.length > 0) {
        const discGross = Math.max(
          Number(orderData.discounts?.total || 0),
          Number(orderData.money?.discountTotal || 0),
        );
        await this.redeemOrderVouchers(
          discountCodes,
          existingOrder.id,
          existingOrder.locationId,
          discGross,
          primaryRef,
        );
      }

      return existingOrder;
    }

    // Normalize line items from payload (supports both orderData.items.lines and orderData.lineItems)
    if (!orderData.items?.lines && Array.isArray(orderData.lineItems)) {
      orderData.items = { lines: orderData.lineItems };
    }

    // Extract any voucher / discount codes from payload
    let discountCodes = this.extractDiscountCodesFromPayload(orderData);

    // 2. If line items are missing from webhook payload or lack prices, fetch full order from Courierify API
    const needsFetch =
      !orderData.items?.lines ||
      !Array.isArray(orderData.items.lines) ||
      orderData.items.lines.length === 0 ||
      orderData.items.lines.some((l: any) => l.unitPrice === undefined && l.price === undefined);

    if (needsFetch) {
      try {
        let fetchedOrder: any = await this.getOrder(orderId || orderName);
        if (fetchedOrder && fetchedOrder.order) {
          fetchedOrder = fetchedOrder.order;
        }
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
          `[Courierify POS] Could not fetch order ${primaryRef} from Courierify API: ${err.message}`,
        );
      }
    }

    // If unit prices are still missing OR discount codes were not in payload, check Shopify API
    const fetchId = orderId || orderName;
    if (fetchId && (needsFetch || discountCodes.length === 0)) {
      this.logger.log(`[Courierify POS] Checking Shopify for true prices/discounts for ${fetchId}`);
      try {
        const shopifyOrder = await this.shopifyService.getOrder(fetchId);
        if (shopifyOrder) {
          if (needsFetch && shopifyOrder.line_items) {
            orderData.items = {
              lines: shopifyOrder.line_items.map((li: any) => ({
                sku: li.sku,
                title: li.name,
                quantity: li.quantity,
                unitPrice: Number(li.price),
              })),
            };
          }
          if (!orderData.discounts?.total && !orderData.money?.discountTotal && shopifyOrder.total_discounts) {
            orderData.money = orderData.money || {};
            orderData.money.discountTotal = Number(shopifyOrder.total_discounts || 0);
          }

          const shCodes = this.shopifyService.extractDiscountCodesFromOrder(shopifyOrder);
          for (const code of shCodes) {
            if (!discountCodes.includes(code)) discountCodes.push(code);
          }
        }
      } catch (err: any) {
        this.logger.warn(`[Courierify POS] Could not fetch Shopify order ${fetchId}: ${err.message}`);
      }
    }

    // 2.5 Fallback: If still no prices, distribute COD amount across items to prevent PKR 0 orders
    if (orderData.items?.lines && Array.isArray(orderData.items.lines) && orderData.items.lines.length > 0) {
      const totalItemsQty = orderData.items.lines.reduce((sum: number, line: any) => sum + (Number(line.quantity) || 1), 0);
      const codTotal = orderData.money?.total || orderData.money?.codToCollect || 0;

      orderData.items.lines = orderData.items.lines.map((line: any) => {
        if (line.unitPrice === undefined && line.price === undefined) {
          const qty = Number(line.quantity) || 1;
          return { ...line, unitPrice: totalItemsQty > 0 ? (codTotal / totalItemsQty) : 0 };
        }
        return line;
      });
    }

    // 3. Resolve Target Location: OMS-IV
    const omsLocation = await this.resolveOmsLocation();
    if (!omsLocation) {
      this.logger.error(
        `[Courierify POS] Target location OMS-IV not found! Cannot process order ${primaryRef}`,
      );
      return null;
    }

    // 4. Resolve Source Warehouse: Warehouse-IV (WH-KHI)
    const warehouseKhi = await this.resolveWarehouseKhi(omsLocation);
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
      price?: number;
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

    let totalDiscountGross = Math.max(
      Number(orderData.discounts?.total || 0),
      Number(orderData.money?.discountTotal || 0),
    );

    // 6a. Differentiate between Vouchers (payment tenders) vs Promotional Discounts
    const voucherPrefixRegex = /^(GFT|EXC|CRD|CRP|OGT|RFD|SHP)-/i;
    let dbVouchers: Array<{ id: string; code: string; faceValue: any }> = [];
    if (discountCodes.length > 0) {
      dbVouchers = await this.prisma.voucher.findMany({
        where: {
          code: { in: discountCodes, mode: 'insensitive' },
          isDeleted: false,
        },
        select: { id: true, code: true, faceValue: true },
      });
    }

    const dbVoucherCodeSet = new Set(
      dbVouchers.map((v) => v.code.toUpperCase().trim()),
    );

    const voucherCodes: string[] = [];
    const promoCodes: string[] = [];
    for (const raw of discountCodes) {
      const code = String(raw).trim().toUpperCase();
      if (dbVoucherCodeSet.has(code) || voucherPrefixRegex.test(code)) {
        voucherCodes.push(code);
      } else {
        promoCodes.push(code);
      }
    }

    const hasVouchers = voucherCodes.length > 0;
    const dbVoucherFaceSum = dbVouchers.reduce(
      (sum, v) => sum + Number(v.faceValue || 0),
      0,
    );

    let voucherAmount = 0;
    let promoDiscountGross = 0;

    if (hasVouchers) {
      // In POS accounting, Vouchers are payment tenders (liabilities), NOT price discounts!
      // Line items retain their retail price, WOST and sales tax are calculated on retail price,
      // and the voucher is applied as a tender under Grand Total (reducing remaining COD/cash to collect).
      if (promoCodes.length === 0) {
        voucherAmount =
          totalDiscountGross > 0
            ? totalDiscountGross
            : dbVoucherFaceSum;
        promoDiscountGross = 0;
      } else {
        voucherAmount = Math.min(
          dbVoucherFaceSum > 0 ? dbVoucherFaceSum : totalDiscountGross,
          totalDiscountGross,
        );
        promoDiscountGross = Math.max(0, totalDiscountGross - voucherAmount);
      }
      this.logger.log(
        `[Courierify POS] Order ${primaryRef}: Voucher Tender = Rs. ${voucherAmount} (${voucherCodes.join(', ')}), Promo Discount = Rs. ${promoDiscountGross}`,
      );
    } else {
      voucherAmount = 0;
      promoDiscountGross = totalDiscountGross;
    }

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
      const retailPrice = Number(line.unitPrice ?? line.price ?? matched.unitPrice ?? 0);
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

    // Convert values to WOST and apply promotional discount on WOST (Vouchers are tenders, NOT deducted from items)
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
        totalGross > 0 && promoDiscountGross > 0
          ? Math.round(
            (line.lineGross / totalGross) * promoDiscountGross * 100,
          ) / 100
          : 0;

      // WOST = Retail / (1 + Tax%)
      const wostPerUnit = line.retailPrice / line.taxDivisor;
      const lineTotalWOST = Math.round(wostPerUnit * line.qty * 100) / 100;

      // Discount on WOST = Promo Discount / (1 + Tax%)
      const lineDiscountWOST =
        shareOfGrossDiscount > 0
          ? Math.round((shareOfGrossDiscount / line.taxDivisor) * 100) / 100
          : 0;
      const afterDiscWOST = Math.max(0, lineTotalWOST - lineDiscountWOST);

      // Tax on amount after promo discount
      const lineTaxAmt =
        Math.round(afterDiscWOST * (line.taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((afterDiscWOST + lineTaxAmt) * 100) / 100;

      const discPct =
        lineTotalWOST > 0 && lineDiscountWOST > 0
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
    const rawPaymentMethod = String(
      orderData.payment?.method || 'COD',
    ).toUpperCase();

    // Advance Payment extraction (supports payment.advance, money.advance, top-level advancePayment/partialPayment)
    const advanceObj = orderData.payment?.advance || orderData.money?.advance;
    const advanceAmount = Number(
      advanceObj?.amount ??
      orderData.advancePayment ??
      orderData.advanceAmount ??
      orderData.partialPayment ??
      0,
    );
    const advanceMethod = advanceObj?.method || 'bank_transfer';
    const advanceRef = advanceObj?.reference || '';

    // COD Amount to collect (supports cod.amount, codAmount, money.codToCollect)
    const codAmount = Number(
      orderData.cod?.amount ??
      orderData.codAmount ??
      orderData.money?.codToCollect ??
      (isPaid ? 0 : Math.max(0, orderGrandTotal - voucherAmount - advanceAmount)),
    );

    let paymentStatus = 'unpaid';
    if (isPaid || (advanceAmount > 0 && advanceAmount >= orderGrandTotal)) {
      paymentStatus = 'paid';
    } else if (advanceAmount > 0) {
      paymentStatus = 'partially_paid';
    }

    const deliveryCharges = Math.max(
      0,
      Number(orderData.money?.total || 0) - Number(orderData.money?.subtotal || 0),
    );

    const cashMemoNotes = [
      `Online Order: #${primaryRef}`,
      `Source: Courierify`,
      `Customer: ${customerName} (${customerPhone || 'N/A'})`,
      `City: ${cityPart || 'N/A'}`,
      `Address: ${fullAddress || 'N/A'}`,
      `Courier: ${courierName}`,
      `Tracking: ${trackingNo}`,
      `Payment: ${rawPaymentMethod} (${paymentStatus.toUpperCase()})`,
      `Total Order: Rs. ${(orderGrandTotal + deliveryCharges) || orderData.money?.total}`,
      deliveryCharges > 0 ? `Delivery Charges: Rs. ${deliveryCharges}` : null,
      advanceAmount > 0 ? `Advance Paid: Rs. ${advanceAmount} (${advanceMethod}${advanceRef ? ' Ref: ' + advanceRef : ''})` : null,
      `COD to Collect: Rs. ${codAmount}`,
      voucherCodes.length > 0 ? `Vouchers: ${voucherCodes.join(', ')}` : null,
      voucherAmount > 0 ? `Voucher Tender: Rs. ${voucherAmount}` : null,
      promoDiscountGross > 0 ? `Discount: Rs. ${promoDiscountGross}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const isCardOrOnline =
      rawPaymentMethod.includes('CARD') ||
      rawPaymentMethod.includes('GATEWAY') ||
      rawPaymentMethod.includes('ONLINE') ||
      rawPaymentMethod.includes('PREPAID') ||
      rawPaymentMethod.includes('STRIPE') ||
      rawPaymentMethod.includes('PAYFAST') ||
      rawPaymentMethod.includes('SHOPIFY');

    const totalOrderAmount = orderGrandTotal + deliveryCharges;
    let resolvedTenderType = 'cash';
    let resolvedCashAmount: number | undefined = undefined;
    let resolvedCardAmount: number | undefined = undefined;

    if (advanceAmount > 0 && codAmount > 0) {
      resolvedTenderType = 'split';
      resolvedCashAmount = codAmount;
      resolvedCardAmount = advanceAmount;
    } else if (advanceAmount > 0) {
      resolvedTenderType = advanceMethod.toLowerCase().includes('cash') ? 'cash' : 'card';
      if (resolvedTenderType === 'card') {
        resolvedCardAmount = advanceAmount;
      } else {
        resolvedCashAmount = advanceAmount;
      }
    } else if (isPaid && (isCardOrOnline || rawPaymentMethod !== 'COD')) {
      resolvedTenderType = 'card';
      resolvedCardAmount = totalOrderAmount;
    } else if (codAmount > 0) {
      resolvedTenderType = 'cash';
      resolvedCashAmount = codAmount;
    }

    const orderDateRaw =
      orderData.orderedAt || orderData.createdAt || occurredAt;
    const orderDate = orderDateRaw ? new Date(orderDateRaw) : new Date();
    const validOrderDate = !isNaN(orderDate.getTime()) ? orderDate : new Date();

    const shouldCreateStn = options.createStn !== false;

    const createdResult = await this.prisma.$transaction(
      async (tx) => {
        let stn: any = null;

        if (shouldCreateStn) {
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

          stn = await tx.transferRequest.create({
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
        }

        // C. Generate POS Order Number
        const orderNumber = await this.posSalesService.generateOrderNumber(
          omsLocation.id,
          tx,
        );

        // D. Create POS SalesOrder
        const finalNotes = stn
          ? `${cashMemoNotes} | STN: ${stn.requestNo}`
          : cashMemoNotes;

        const posOrder = await tx.salesOrder.create({
          data: {
            orderNumber,
            referenceNumber: primaryRef,
            locationId: omsLocation.id,
            customerId,
            paymentMethod: isCardOrOnline ? 'card' : rawPaymentMethod,
            paymentStatus,
            status: shouldCreateStn ? 'booked' : 'pending',
            notes: finalNotes,
            subtotal: new Prisma.Decimal(orderSubtotalWOST),
            discountAmount: new Prisma.Decimal(orderDiscountWOST),
            taxAmount: new Prisma.Decimal(orderTaxAmount),
            grandTotal: new Prisma.Decimal(orderGrandTotal + deliveryCharges),
            voucherAmount:
              voucherAmount > 0
                ? new Prisma.Decimal(voucherAmount)
                : undefined,
            tenderType: resolvedTenderType,
            cashAmount: resolvedCashAmount ? new Prisma.Decimal(resolvedCashAmount) : undefined,
            cardAmount: resolvedCardAmount ? new Prisma.Decimal(resolvedCardAmount) : undefined,
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

        if (shouldCreateStn && stn) {
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

          // Link STN to POS Order so frontend can find it via notes search
          await tx.transferRequest.update({
            where: { id: stn.id },
            data: { notes: `${stn.notes} | ref:${posOrder.id}` },
          });
        }

        return { posOrder, stn };
      },
      {
        maxWait: 20000,
        timeout: 60000,
      },
    );

    this.logger.log(
      `[Courierify POS] Created POS Order #${createdResult.posOrder.orderNumber} ${createdResult.stn ? `(STN #${createdResult.stn.requestNo})` : '(Pending Shipment - No STN yet)'} for OMS Order #${primaryRef}`,
    );

    // 8. FBR Sync (Non-blocking, only for booked shipments)
    if (
      shouldCreateStn &&
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

    // 9. Redeem vouchers in POS and remove/deactivate on Shopify
    if (voucherCodes.length > 0) {
      await this.redeemOrderVouchers(
        voucherCodes,
        createdResult.posOrder.id,
        omsLocation.id,
        voucherAmount,
        primaryRef,
      );
    }

    return createdResult.posOrder;
  }

  /**
   * Helper to create Automatic Transfer Request (STN) for an existing POS SalesOrder:
   * 1. Resolves OMS-IV Location and WH-KHI Warehouse.
   * 2. Creates TransferRequest (from WH-KHI to OMS-IV, status: COMPLETED, transferType: WAREHOUSE_TO_OUTLET).
   * 3. Executes Stock Ledger movements:
   *    - WH-KHI Outbound (-qty) & decrements inventoryItem at WH-KHI
   *    - OMS-IV Inbound (+qty) & increments inventoryItem at OMS-IV
   *    - Deducts POS Sale from OMS-IV (-qty) & decrements inventoryItem at OMS-IV
   * 4. Links STN to the POS SalesOrder.
   */
  async createStnForExistingOrder(
    existingOrder: any,
    shipmentPayload: any,
  ): Promise<any> {
    const courierName =
      shipmentPayload?.courier || shipmentPayload?.assignedCourier || 'Courier';
    const trackingNo =
      shipmentPayload?.trackingNumber || 'Pending';
    const primaryRef = existingOrder.referenceNumber || existingOrder.orderNumber;

    const omsLocation = await this.resolveOmsLocation(existingOrder.locationId);
    if (!omsLocation) {
      this.logger.error(
        `[Courierify POS] Cannot create STN: Target OMS location not found for order #${primaryRef}`,
      );
      return null;
    }

    const warehouseKhi = await this.resolveWarehouseKhi(omsLocation);
    if (!warehouseKhi) {
      this.logger.error(
        `[Courierify POS] Cannot create STN: Source warehouse WH-KHI not found for order #${primaryRef}`,
      );
      return null;
    }

    let items = existingOrder.items || [];
    if (items.length === 0) {
      items = await this.prisma.salesOrderItem.findMany({
        where: { salesOrderId: existingOrder.id },
      });
    }

    if (items.length === 0) {
      this.logger.warn(
        `[Courierify POS] Cannot create STN: No items found on order #${primaryRef}`,
      );
      return null;
    }

    return await this.prisma.$transaction(
      async (tx) => {
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

        const stnRemarks = `STN for Online OMS Order #${primaryRef} | Courier: ${courierName} | Tracking: ${trackingNo} | ref:${existingOrder.id}`;

        const stn = await tx.transferRequest.create({
          data: {
            requestNo,
            fromWarehouseId: warehouseKhi.id,
            toLocationId: omsLocation.id,
            transferType: 'WAREHOUSE_TO_OUTLET',
            status: 'COMPLETED',
            notes: stnRemarks,
            items: {
              create: items.map((it: any) => ({
                itemId: it.itemId,
                quantity: new Prisma.Decimal(Number(it.quantity)),
                fulfilledQty: new Prisma.Decimal(Number(it.quantity)),
              })),
            },
          },
        });

        // Stock movements: WH-KHI (OUTBOUND) -> OMS-IV (INBOUND)
        for (const it of items) {
          const qty = Number(it.quantity);

          // 1. WH-KHI Outbound
          await this.stockLedgerService.createEntry(
            {
              itemId: it.itemId,
              warehouseId: warehouseKhi.id,
              qty: -qty,
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
              data: { quantity: { decrement: qty } },
            });
          } else {
            await tx.inventoryItem.create({
              data: {
                itemId: it.itemId,
                warehouseId: warehouseKhi.id,
                locationId: null,
                quantity: -qty,
                status: 'AVAILABLE',
              },
            });
          }

          // 2. OMS-IV Inbound
          await this.stockLedgerService.createEntry(
            {
              itemId: it.itemId,
              warehouseId: warehouseKhi.id,
              locationId: omsLocation.id,
              qty: qty,
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
              data: { quantity: { increment: qty } },
            });
          } else {
            await tx.inventoryItem.create({
              data: {
                itemId: it.itemId,
                warehouseId: warehouseKhi.id,
                locationId: omsLocation.id,
                quantity: qty,
                status: 'AVAILABLE',
              },
            });
          }

          // 3. Deduct POS Sale from OMS-IV (Balances inbound STN)
          await this.stockLedgerService.createEntry(
            {
              itemId: it.itemId,
              warehouseId: warehouseKhi.id,
              locationId: omsLocation.id,
              qty: -qty,
              movementType: MovementType.OUTBOUND,
              referenceType: 'POS_SALE',
              referenceId: existingOrder.id,
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
              data: { quantity: { decrement: qty } },
            });
          }
        }

        this.logger.log(
          `[Courierify POS] Created Automatic STN #${stn.requestNo} for existing order #${existingOrder.orderNumber} on shipment.booked`,
        );

        return stn;
      },
      { maxWait: 20000, timeout: 60000 },
    );
  }

  /**
   * Return stock from OMS back to Warehouse WH-KHI when an order is returned or cancelled:
   * 1. Checks if the order had an outbound STN (if not, stock never left WH-KHI, simply marks cancelled/returned).
   * 2. Checks idempotency: if return STN already created, skips.
   * 3. Generates Return STN (transferType: OUTLET_TO_WAREHOUSE) from OMS-IV to WH-KHI.
   * 4. Reverses POS Sale at OMS-IV (Inbound) and transfers Outbound to WH-KHI (Inbound at WH-KHI).
   * 5. Increments inventoryItem quantity at WH-KHI.
   * 6. Updates SalesOrder status to 'returned' or 'cancelled' and appends Return STN number to notes.
   */
  async autoReturnToWarehouse(params: {
    orderName?: string;
    orderId?: string;
    salesOrderId?: string;
    reason?: string;
    trackingNumber?: string;
  }): Promise<void> {
    const ref = params.orderName || params.orderId;
    this.logger.log(
      `[OMS Auto-Return] Initiating for ref: ${ref || params.salesOrderId} (Reason: ${params.reason || 'N/A'})`,
    );

    let salesOrder: any = null;
    if (params.salesOrderId) {
      salesOrder = await this.prisma.salesOrder.findUnique({
        where: { id: params.salesOrderId },
        include: { items: true },
      });
    } else if (ref) {
      salesOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: String(ref) },
            { referenceNumber: String(ref) },
            { orderNumber: `CRF-${ref}` },
            ...(params.orderId ? [{ referenceNumber: String(params.orderId) }] : []),
          ],
        },
        include: { items: true },
      });
    }

    if (!salesOrder) {
      this.logger.warn(
        `[OMS Auto-Return] SalesOrder not found for ref: ${ref || params.salesOrderId}. Skipping.`,
      );
      return;
    }

    const isCancelled =
      params.reason?.toLowerCase().includes('cancel') ||
      salesOrder.status === 'cancelled';
    const targetStatus = isCancelled ? 'cancelled' : 'returned';

    // Idempotency check: check if Return STN was already created for this order
    const existingReturnStn = await this.prisma.transferRequest.findFirst({
      where: {
        transferType: 'OUTLET_TO_WAREHOUSE',
        notes: { contains: '[AUTO-RETURN]' },
        OR: [
          { notes: { contains: `ref:${salesOrder.id}` } },
          { notes: { contains: `#${salesOrder.referenceNumber || salesOrder.orderNumber}` } },
          { notes: { contains: salesOrder.orderNumber } },
        ],
      },
    });

    if (existingReturnStn) {
      this.logger.log(
        `[OMS Auto-Return] Order #${salesOrder.orderNumber} already returned via STN #${existingReturnStn.requestNo}. Skipping duplicate stock movement.`,
      );
      if (salesOrder.status !== targetStatus) {
        await this.prisma.salesOrder.update({
          where: { id: salesOrder.id },
          data: { status: targetStatus },
        });
      }
      return;
    }

    // Check if original outbound STN was created
    const originalStn = await this.prisma.transferRequest.findFirst({
      where: {
        transferType: 'WAREHOUSE_TO_OUTLET',
        OR: [
          { notes: { contains: `ref:${salesOrder.id}` } },
          { notes: { contains: `#${salesOrder.referenceNumber || salesOrder.orderNumber}` } },
          { notes: { contains: salesOrder.orderNumber } },
        ],
      },
    });

    const hadOutboundStn = Boolean(
      originalStn || salesOrder.notes?.includes('STN: TR-'),
    );

    if (!hadOutboundStn) {
      this.logger.log(
        `[OMS Auto-Return] Order #${salesOrder.orderNumber} had no outbound STN (stock was never deducted from warehouse). Simply marking as ${targetStatus}.`,
      );
      await this.prisma.salesOrder.update({
        where: { id: salesOrder.id },
        data: { status: targetStatus },
      });
      return;
    }

    const omsLocation = await this.resolveOmsLocation(salesOrder.locationId);
    if (!omsLocation) {
      this.logger.error(
        `[OMS Auto-Return] Target OMS location not found for order #${salesOrder.orderNumber}`,
      );
      return;
    }

    const warehouseKhi = await this.resolveWarehouseKhi(omsLocation);
    if (!warehouseKhi) {
      this.logger.error(
        `[OMS Auto-Return] Warehouse WH-KHI not found for order #${salesOrder.orderNumber}`,
      );
      return;
    }

    let itemsToReturn = salesOrder.items || [];
    if (itemsToReturn.length === 0) {
      itemsToReturn = await this.prisma.salesOrderItem.findMany({
        where: { salesOrderId: salesOrder.id },
      });
    }

    if (itemsToReturn.length === 0) {
      this.logger.warn(
        `[OMS Auto-Return] No items to return on order #${salesOrder.orderNumber}. Updating status only.`,
      );
      await this.prisma.salesOrder.update({
        where: { id: salesOrder.id },
        data: { status: targetStatus },
      });
      return;
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
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

          const returnReason =
            params.reason || (isCancelled ? 'Order Cancelled' : 'Courier Return');
          const trackingInfo = params.trackingNumber
            ? ` | Tracking: ${params.trackingNumber}`
            : '';
          const origStnRef = originalStn
            ? ` | Outbound STN: ${originalStn.requestNo}`
            : '';
          const notes = `[AUTO-RETURN] ${returnReason} for Online OMS Order #${salesOrder.referenceNumber || salesOrder.orderNumber}${trackingInfo}${origStnRef} | ref:${salesOrder.id}`;

          // Create Return STN: OMS-IV -> WH-KHI
          const returnStn = await tx.transferRequest.create({
            data: {
              requestNo,
              fromLocationId: omsLocation.id,
              toWarehouseId: warehouseKhi.id,
              transferType: 'OUTLET_TO_WAREHOUSE',
              status: 'COMPLETED',
              notes,
              items: {
                create: itemsToReturn.map((it: any) => ({
                  itemId: it.itemId,
                  quantity: new Prisma.Decimal(Number(it.quantity)),
                  fulfilledQty: new Prisma.Decimal(Number(it.quantity)),
                })),
              },
            },
          });

          // Stock movements for each item:
          for (const it of itemsToReturn) {
            const qty = Number(it.quantity);

            // A. Reverse POS Sale at OMS-IV (Inbound to OMS-IV)
            await this.stockLedgerService.createEntry(
              {
                itemId: it.itemId,
                warehouseId: warehouseKhi.id,
                locationId: omsLocation.id,
                qty: qty,
                movementType: MovementType.INBOUND,
                referenceType: isCancelled ? 'POS_CANCELLED' : 'POS_RETURN',
                referenceId: salesOrder.id,
                allowNegativeStock: true,
              },
              tx,
            );

            // Increment inventoryItem at OMS-IV
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
                data: { quantity: { increment: qty } },
              });
            } else {
              await tx.inventoryItem.create({
                data: {
                  itemId: it.itemId,
                  warehouseId: warehouseKhi.id,
                  locationId: omsLocation.id,
                  quantity: qty,
                  status: 'AVAILABLE',
                },
              });
            }

            // B. Return STN: Outbound from OMS-IV
            await this.stockLedgerService.createEntry(
              {
                itemId: it.itemId,
                warehouseId: warehouseKhi.id,
                locationId: omsLocation.id,
                qty: -qty,
                movementType: MovementType.OUTBOUND,
                referenceType: 'TRANSFER_REQUEST',
                referenceId: returnStn.id,
                allowNegativeStock: true,
              },
              tx,
            );

            // Decrement inventoryItem at OMS-IV
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
                data: { quantity: { decrement: qty } },
              });
            }

            // C. Return STN: Inbound to WH-KHI (Stock safely back in warehouse!)
            await this.stockLedgerService.createEntry(
              {
                itemId: it.itemId,
                warehouseId: warehouseKhi.id,
                locationId: null,
                qty: qty,
                movementType: MovementType.INBOUND,
                referenceType: 'TRANSFER_REQUEST',
                referenceId: returnStn.id,
                allowNegativeStock: true,
              },
              tx,
            );

            // Increment inventoryItem at WH-KHI
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
                data: { quantity: { increment: qty } },
              });
            } else {
              await tx.inventoryItem.create({
                data: {
                  itemId: it.itemId,
                  warehouseId: warehouseKhi.id,
                  locationId: null,
                  quantity: qty,
                  status: 'AVAILABLE',
                },
              });
            }
          }

          // Update SalesOrder status and notes
          const updatedNotes = salesOrder.notes
            ? `${salesOrder.notes} | Return STN: ${returnStn.requestNo}`
            : `Return STN: ${returnStn.requestNo}`;

          await tx.salesOrder.update({
            where: { id: salesOrder.id },
            data: {
              status: targetStatus,
              notes: updatedNotes,
            },
          });

          this.logger.log(
            `[OMS Auto-Return] Created Return STN #${returnStn.requestNo} for order #${salesOrder.orderNumber}. Stock successfully returned to warehouse ${warehouseKhi.code}.`,
          );
        },
        { maxWait: 20000, timeout: 60000 },
      );
    } catch (err: any) {
      this.logger.error(
        `[OMS Auto-Return] Failed for order #${salesOrder.orderNumber}: ${err.message}`,
        err.stack,
      );
    }
  }

  private async onShipmentBooked(
    data: any,
    occurredAt?: string,
  ): Promise<void> {
    const payload = data?.shipment || data || {};
    const { orderName, orderId, trackingNumber, courier } = payload;
    this.logger.log(
      `[Shipment Booked] Order: ${orderName || orderId}, Tracking: ${trackingNumber}, Courier: ${courier}`,
    );

    const ref = orderName || orderId;
    if (!ref) {
      this.logger.warn('[Shipment Booked] Missing orderName/orderId in payload');
      return;
    }

    const existingOrder = await this.prisma.salesOrder.findFirst({
      where: {
        OR: [
          { orderNumber: String(ref) },
          { referenceNumber: String(ref) },
          { orderNumber: `CRF-${ref}` },
          ...(orderId ? [{ referenceNumber: String(orderId) }] : []),
        ],
      },
      include: { items: true },
    });

    if (existingOrder) {
      // Check if STN already exists for this order
      let existingStn = await this.prisma.transferRequest.findFirst({
        where: {
          transferType: 'WAREHOUSE_TO_OUTLET',
          OR: [
            { notes: { contains: `ref:${existingOrder.id}` } },
            { notes: { contains: `#${existingOrder.referenceNumber || existingOrder.orderNumber}` } },
            { notes: { contains: existingOrder.orderNumber } },
          ],
        },
      });

      const hadStn = Boolean(existingStn || existingOrder.notes?.includes('STN: TR-'));

      if (!hadStn) {
        // Order exists (e.g. from order.created), but NO STN was created yet!
        // Generate Automatic Transfer Request now on shipment.booked!
        existingStn = await this.createStnForExistingOrder(existingOrder, payload);
      } else {
        this.logger.log(
          `[Shipment Booked] Order #${existingOrder.orderNumber} already has STN #${existingStn?.requestNo || 'created'}. Updating tracking/courier info.`,
        );
      }

      // Update existing order shipping & payment details
      const advanceObj =
        payload.payment?.advance || payload.money?.advance || payload.advancePayment;
      const advanceAmt = Number(advanceObj?.amount ?? advanceObj ?? 0);
      const codAmt = Number(
        payload.cod?.amount ?? payload.codAmount ?? payload.money?.codToCollect ?? 0,
      );

      const courierPart = courier ? `Courier: ${courier}` : null;
      const trackPart = trackingNumber ? `Tracking: ${trackingNumber}` : null;
      const shippingNote = [courierPart, trackPart].filter(Boolean).join(', ');

      let updatedNotes = existingOrder.notes || '';
      if (shippingNote && !updatedNotes.includes(shippingNote)) {
        updatedNotes = updatedNotes ? `${updatedNotes} | ${shippingNote}` : shippingNote;
      }
      if (existingStn && !updatedNotes.includes(existingStn.requestNo)) {
        updatedNotes = `${updatedNotes} | STN: ${existingStn.requestNo}`;
      }

      const updateData: any = {
        status: 'booked',
        notes: updatedNotes,
      };

      if (advanceAmt > 0 && !existingOrder.cardAmount) {
        updateData.cardAmount = new Prisma.Decimal(advanceAmt);
        if (codAmt > 0 && !existingOrder.cashAmount) {
          updateData.cashAmount = new Prisma.Decimal(codAmt);
          updateData.paymentStatus = 'partially_paid';
          updateData.tenderType = 'split';
        }
      }

      await this.prisma.salesOrder.update({
        where: { id: existingOrder.id },
        data: updateData,
      });

      this.logger.log(
        `[Courierify] Updated local order #${existingOrder.orderNumber} to status=booked${existingStn ? ` (STN #${existingStn.requestNo})` : ''}`,
      );

      // Redeem any vouchers if present in payload
      const voucherPrefixRegex = /^(GFT|EXC|CRD|CRP|OGT|RFD|SHP)-/i;
      const discountCodes = this.extractDiscountCodesFromPayload(payload).filter(
        (c) => voucherPrefixRegex.test(c),
      );
      if (discountCodes.length > 0) {
        const discGross = Math.max(
          Number(payload.discounts?.total || 0),
          Number(payload.money?.discountTotal || 0),
        );
        await this.redeemOrderVouchers(
          discountCodes,
          existingOrder.id,
          existingOrder.locationId,
          discGross,
          orderName || orderId,
        );
      }
    } else {
      // Order not found locally -> create full POS order AND STN on shipment.booked
      const advanceObj =
        payload.payment?.advance || payload.money?.advance || payload.advancePayment;
      const advanceAmt = Number(advanceObj?.amount ?? advanceObj ?? 0);
      const codAmt = Number(
        payload.cod?.amount ?? payload.codAmount ?? payload.money?.codToCollect ?? 0,
      );
      const totalAmt = Number(
        payload.money?.total ?? payload.totalAmount ?? codAmt + advanceAmt,
      );

      const normalizedData = {
        ...payload,
        items: payload.items?.lines ? payload.items : { lines: payload.lineItems || [] },
        lineItems: payload.lineItems || [],
        discounts: payload.discounts || { codes: [], total: 0, applications: [] },
        money: {
          currency: payload.money?.currency || 'PKR',
          total: totalAmt,
          subtotal: Number(payload.money?.subtotal || totalAmt),
          discountTotal: Number(
            payload.money?.discountTotal || payload.discounts?.total || 0,
          ),
          codToCollect: codAmt,
          advance: advanceObj
            ? {
              amount: advanceAmt,
              method: advanceObj.method || 'bank_transfer',
              reference: advanceObj.reference || '',
              collectedAt: advanceObj.collectedAt || occurredAt,
            }
            : undefined,
        },
      };

      await this.processOmsOrderToPos(normalizedData, occurredAt, { createStn: true });
    }
  }

  private async onShipmentStatusChanged(data: any): Promise<void> {
    const payload = data?.shipment || data || {};
    const { trackingNumber, status, courierStatus, orderName, orderId } = payload;
    this.logger.log(
      `[Shipment Status Changed] Tracking: ${trackingNumber}, Status: ${status} (${courierStatus})`,
    );

    const rawStatus = (status || '').toLowerCase().trim();
    const rawCourierStatus = (courierStatus || '').toLowerCase().trim();

    if (rawStatus === 'delivered' || rawCourierStatus === 'delivered') {
      await this.onShipmentDelivered(payload);
    } else if (
      rawStatus === 'returned' ||
      rawStatus === 'rto' ||
      rawStatus.includes('return') ||
      rawCourierStatus.includes('return') ||
      rawCourierStatus.includes('rto')
    ) {
      await this.autoReturnToWarehouse({
        orderName,
        orderId,
        trackingNumber,
        reason: `Courier Return (${courierStatus || status})`,
      });
    } else if (
      rawStatus === 'cancelled' ||
      rawStatus === 'canceled' ||
      rawCourierStatus.includes('cancel')
    ) {
      await this.autoReturnToWarehouse({
        orderName,
        orderId,
        trackingNumber,
        reason: `Shipment Cancelled (${courierStatus || status})`,
      });
    } else if (rawStatus === 'booked') {
      await this.onShipmentBooked(payload);
    } else if (orderName || orderId) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: String(orderName || orderId) },
            { referenceNumber: String(orderId || orderName) },
            { orderNumber: `CRF-${orderName || orderId}` },
          ],
        },
      });

      if (existingOrder) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: { status: rawStatus || existingOrder.status },
        });
        this.logger.log(
          `[Courierify] Updated order #${existingOrder.orderNumber} status to: ${rawStatus}`,
        );
      }
    }
  }

  private async onShipmentDelivered(data: any): Promise<void> {
    const payload = data?.shipment || data || {};
    const { trackingNumber, orderName, orderId, deliveredAt, codAmount, cod } =
      payload;
    const ref = orderName || orderId;
    this.logger.log(
      `[Shipment Delivered] Order: ${ref}, Tracking: ${trackingNumber}, COD: ${codAmount || cod?.amount}`,
    );

    if (ref) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: String(ref) },
            { referenceNumber: String(ref) },
            { orderNumber: `CRF-${ref}` },
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
    const payload = data?.shipment || data?.return || data || {};
    const { trackingNumber, orderName, orderId, receivedAt } = payload;
    this.logger.log(
      `[Return Received] Order: ${orderName || orderId}, Tracking: ${trackingNumber}, ReceivedAt: ${receivedAt}`,
    );

    await this.autoReturnToWarehouse({
      orderName,
      orderId,
      trackingNumber,
      reason: 'Return Received at Warehouse',
    });
  }

  /**
   * Handle order/shipment cancellation webhook and trigger auto return to warehouse if needed
   */
  async onOrderCancelled(data: any): Promise<void> {
    const payload = data?.order || data?.shipment || data || {};
    const orderName = payload.orderName || payload.name || payload.orderNumber;
    const orderId = payload.orderId || payload.id;
    const trackingNumber =
      payload.trackingNumber || payload.shipment?.trackingNumber;
    this.logger.log(
      `[Order/Shipment Cancelled] Order: ${orderName || orderId}, Tracking: ${trackingNumber}`,
    );

    await this.autoReturnToWarehouse({
      orderName,
      orderId,
      trackingNumber,
      reason: 'Order/Shipment Cancelled',
    });
  }

  private async onSettlementReceived(data: any): Promise<void> {
    const { settlementNumber, courier, netPaidAmount, parcelCount } = data || {};
    this.logger.log(
      `[Settlement Received] #${settlementNumber} from ${courier}: Net Paid = ${netPaidAmount} for ${parcelCount} parcels`,
    );
  }
}
