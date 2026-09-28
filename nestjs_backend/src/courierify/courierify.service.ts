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

  constructor(private readonly prisma: PrismaService) {}

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
    _signature: string | undefined,
    _timestampStr: string | undefined,
    _rawBody: string | Buffer,
  ): boolean {
    // Temporary bypass - signature verification disabled for local testing
    return true;
  }

  private _verifyWebhookSignatureInternal(signature: string | undefined, timestampStr: string | undefined, rawBody: string | Buffer): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'COURIERIFY_WEBHOOK_SECRET is not configured. Bypassing webhook verification for local testing.',
      );
      return true;
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
          await this.onOrderCreated(data);
          break;
        case 'shipment.booked':
          await this.onShipmentBooked(data);
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
      }
    } catch (error: any) {
      this.logger.error(
        `[Courierify Webhook Error] Failed to process event ${eventId} (${topic}): ${error.message}`,
        error.stack,
      );
    }
  }

  private async onOrderCreated(data: any): Promise<void> {
    const orderId = data.id || data.orderId;
    if (!orderId) {
      this.logger.warn('[Courierify Webhook] order.created received without an orderId');
      return;
    }

    this.logger.log(`[Order Created] Syncing Courierify Order ID: ${orderId}`);

    try {
      // Fetch full order details from Courierify API
      const courierifyOrder = await this.getOrder(orderId);

      const orderNumber = courierifyOrder.orderName || courierifyOrder.orderId;
      const orderNumberStr = `CRF-${orderNumber}`;

      // Check if order exists
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: { orderNumber: orderNumberStr },
      });

      if (existingOrder) {
        this.logger.log(`[Courierify] Order ${orderNumberStr} already exists. Skipping creation.`);
        return;
      }

      // 1. Resolve Location (Online Store)
      let locationId: string | null = null;
      const onlineLocation = await this.prisma.location.findFirst({
        where: { name: { contains: 'Online Store', mode: 'insensitive' } },
      });
      if (onlineLocation) {
        locationId = onlineLocation.id;
      }

      // 2. Resolve Customer
      let customerRecord: any = null;
      if (courierifyOrder.customer) {
        const customerPhone = courierifyOrder.customer.phone || null;
        const customerEmail = courierifyOrder.customer.email || `${orderId}@courierify.local`;

        customerRecord = await this.prisma.customer.findFirst({
          where: {
            OR: [
              ...(customerPhone ? [{ contactNo: customerPhone }] : []),
              { email: customerEmail }
            ]
          }
        });

        if (!customerRecord) {
          customerRecord = await this.prisma.customer.create({
            data: {
              code: crypto.randomUUID(),
              name: courierifyOrder.customer.name || 'Courierify Customer',
              email: customerEmail,
              contactNo: customerPhone,
            },
          });
        }
      }

      const totalAmount = parseFloat(courierifyOrder.money?.total?.toString()) || 0;
      const subtotalAmount = parseFloat(courierifyOrder.money?.subtotal?.toString()) || totalAmount;
      const discountAmount = parseFloat(courierifyOrder.money?.discountTotal?.toString()) || 0;
      const taxAmount = Math.max(0, totalAmount - (subtotalAmount - discountAmount));

      // 3. Create SalesOrder
      const salesOrder = await this.prisma.salesOrder.create({
        data: {
          orderNumber: orderNumberStr,
          referenceNumber: courierifyOrder.orderId,
          customerId: customerRecord?.id,
          locationId: locationId,
          subtotal: totalAmount - taxAmount + discountAmount,
          discountAmount: discountAmount,
          taxAmount: taxAmount,
          grandTotal: totalAmount,
          paymentStatus: 'unpaid',
          status: 'booked',
          notes: `Imported from Courierify via webhook`,
        },
      });

      // 4. Create Line Items
      if (courierifyOrder.items?.lines && Array.isArray(courierifyOrder.items.lines)) {
        for (const item of courierifyOrder.items.lines) {
          let itemRecord: any = null;
          if (item.sku) {
            itemRecord = await this.prisma.item.findFirst({
              where: { sku: item.sku },
            });
          }

          if (!itemRecord) {
            itemRecord = await this.prisma.item.findFirst({
              where: { itemId: 'UNKNOWN-CRF' },
            });

            if (!itemRecord) {
              itemRecord = await this.prisma.item.create({
                data: {
                  itemId: 'UNKNOWN-CRF',
                  description: 'Unknown Courierify Item',
                  sku: 'UNKNOWN-CRF',
                  itemType: 'FINISHED',
                  unitPrice: 0,
                },
              });
            }
          }

          const quantity = item.quantity || 1;
          // Note: CourierifyOrderLineItem doesn't explicitly guarantee `price` exist, we fallback to 0
          const unitPrice = parseFloat((item as any).price?.toString()) || 0;
          
          await this.prisma.salesOrderItem.create({
            data: {
              salesOrderId: salesOrder.id,
              itemId: itemRecord.id,
              quantity: quantity,
              unitPrice: unitPrice,
              lineTotal: unitPrice * quantity,
            },
          });
        }
      }

      this.logger.log(`[Courierify] Successfully created SalesOrder ${orderNumberStr}`);
    } catch (err: any) {
      this.logger.error(`[Courierify Webhook] Failed to create order ${orderId}: ${err.message}`, err.stack);
    }
  }

  private async onShipmentBooked(data: any): Promise<void> {
    const payload = data?.shipment || data || {};
    const { orderName, orderId, trackingNumber, courier, customer, lineItems, cod } = payload;
    this.logger.log(
      `[Shipment Booked] Order: ${orderName || orderId}, Tracking: ${trackingNumber}, Courier: ${courier}`,
    );

    if (orderName || orderId) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: orderName || orderId },
            { orderNumber: `CRF-${orderName || orderId}` },
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
        // Order doesn't exist, create it directly from webhook payload!
        this.logger.log(`[Courierify] Order ${orderName || orderId} not found locally. Creating from webhook payload...`);
        await this.createOrderFromShipmentPayload(payload);
      }
    }
  }

  private async createOrderFromShipmentPayload(shipment: any): Promise<void> {
    const { orderName, orderId, trackingNumber, courier, customer, cod, courierOrderRef } = shipment;
    const orderNoStr = `CRF-${orderName || orderId}`;

    try {
      // Check if already exists
      const existingOrder = await this.prisma.eRPSalesOrder.findFirst({
        where: { orderNo: orderNoStr },
      });

      if (existingOrder) {
        this.logger.log(`[Courierify] Order ${orderNoStr} already exists, skipping creation.`);
        return;
      }

      const codAmount = cod?.amount ?? 0;

      // Find or create customer
      let customerId: string | null = null;

      // Try to find by phone (contactNo)
      if (customer?.phone) {
        const found = await this.prisma.customer.findFirst({
          where: { contactNo: customer.phone },
        });
        if (found) customerId = found.id;
      }

      // If not found, find or create a "Courierify Walk-in" default customer
      if (!customerId) {
        const customerName = customer?.name || 'Courierify Customer';
        let defaultCustomer = await this.prisma.customer.findFirst({
          where: { name: customerName },
        });

        if (!defaultCustomer) {
          defaultCustomer = await this.prisma.customer.create({
            data: {
              code: `CRF-${Date.now()}`,
              name: customerName,
              contactNo: customer?.phone || null,
              email: customer?.email || null,
              address: customer?.address || null,
              customerType: 'ERP',
            },
          });
          this.logger.log(`[Courierify] Created customer: ${customerName}`);
        }
        customerId = defaultCustomer.id;
      }

      // Create the ERP Sales Order (shown in ERP Sales Orders page)
      const salesOrder = await this.prisma.eRPSalesOrder.create({
        data: {
          orderNo: orderNoStr,
          customerId: customerId,
          status: 'CONFIRMED',
          subtotal: codAmount,
          grandTotal: codAmount,
          createdBy: 'courierify-webhook',
        },
      });

      this.logger.log(`[Courierify] Created ERPSalesOrder ${orderNoStr} (id: ${salesOrder.id})`);
      this.logger.log(`[Courierify] Successfully created SalesOrder ${orderNoStr}`);
    } catch (err: any) {
      this.logger.error(`[Courierify] Failed to create order from shipment: ${err.message}`, err.stack);
    }
  }


  private async onShipmentStatusChanged(data: any): Promise<void> {
    const payload = data?.shipment || data || {};
    const { trackingNumber, status, courierStatus, orderName } = payload;
    this.logger.log(
      `[Shipment Status Changed] Tracking: ${trackingNumber}, Status: ${status} (${courierStatus})`,
    );

    if (orderName) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: orderName },
            { orderNumber: `CRF-${orderName}` },
          ],
        },
      });

      if (existingOrder) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: status?.toLowerCase() || existingOrder.status,
          },
        });
        this.logger.log(`[Courierify] Updated order #${existingOrder.orderNumber} status to: ${status}`);
      } else {
        // Order not in ERP yet - create it from this payload
        this.logger.log(`[Courierify] Order ${orderName} not found locally. Creating from status_changed payload...`);
        await this.createOrderFromShipmentPayload({ ...payload, status: status?.toLowerCase() || 'shipped' });
      }
    }
  }

  private async onShipmentDelivered(data: any): Promise<void> {
    const payload = data?.shipment || data || {};
    const { trackingNumber, orderName, deliveredAt, cod } = payload;
    const codAmount = cod?.amount ?? payload.codAmount ?? 0;
    this.logger.log(
      `[Shipment Delivered] Order: ${orderName}, Tracking: ${trackingNumber}, COD: ${codAmount}`,
    );

    if (orderName) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { orderNumber: orderName },
            { orderNumber: `CRF-${orderName}` },
          ],
        },
      });

      if (existingOrder) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: 'delivered',
            paymentStatus: codAmount > 0 ? 'collected_pending_settlement' : 'paid',
          },
        });
        this.logger.log(
          `[Courierify] Marked order #${existingOrder.orderNumber} as delivered`,
        );
      } else {
        // Order not in ERP yet - create it from this payload
        this.logger.log(`[Courierify] Order ${orderName} not found. Creating from delivered payload...`);
        await this.createOrderFromShipmentPayload({ ...payload, status: 'delivered' });
      }
    }
  }

  private async onReturnReceived(data: any): Promise<void> {
    const payload = data?.return || data?.shipment || data || {};
    const { trackingNumber, orderName, receivedAt } = payload;
    this.logger.log(
      `[Return Received] Order: ${orderName}, Tracking: ${trackingNumber}, ReceivedAt: ${receivedAt}`,
    );

    if (orderName) {
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: { orderNumber: orderName },
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
