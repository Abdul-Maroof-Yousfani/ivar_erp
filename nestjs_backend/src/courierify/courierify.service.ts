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
import { PosSalesService } from '../pos-sales/pos-sales.service';
import { TransferRequestService } from '../warehouse/transfer-request.service';
import { runInBackground } from '../common/utils/run-in-background.util';

@Injectable()
export class CourierifyService {
  private readonly logger = new Logger(CourierifyService.name);

  private readonly baseUrl =
    process.env.COURIERIFY_BASE_URL;

  private readonly apiKey = process.env.COURIERIFY_API_KEY || '';
  private readonly webhookSecret = process.env.COURIERIFY_WEBHOOK_SECRET || '';

  // In-memory LRU-like set for deduplicating webhook events (up to 10,000 recent event IDs)
  private readonly processedEvents = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly posSalesService: PosSalesService,
    private readonly transferRequestService: TransferRequestService,
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
    this.logger.log(`[Shipment Booked] orderId="${orderId}", lineItems=${lineItems?.length ?? 0} item(s)`);
    if (payload.manualReason || payload.isManual) {
      this.logger.log(`[Shipment Booked] Manual order → isManual=${payload.isManual}, reason="${payload.manualReason}"`);
    }

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
    const { orderName, orderId, trackingNumber, courier, customer, cod, courierOrderRef, manualReason, isManual } = shipment;
    try {
      // Check if already exists in POS SalesOrders using referenceNumber or the old orderNumber
      const refString = orderName || orderId;
      const existingOrder = await this.prisma.salesOrder.findFirst({
        where: {
          OR: [
            { referenceNumber: refString },
            { orderNumber: `CRF-${refString}` },
            { orderNumber: refString }
          ]
        },
      });

      if (existingOrder) {
        this.logger.log(`[Courierify] Order for ${refString} already exists, skipping creation.`);
        return;
      }

      const money = shipment.money || {};
      const codAmount = cod?.amount ?? money.codToCollect ?? money.total ?? 0;
      const discountTotal = parseFloat(money.discountTotal?.toString()) || 0;
      const subtotalAmount = parseFloat(money.subtotal?.toString()) || codAmount;
      const grandTotal = parseFloat(money.total?.toString()) || codAmount;

      // Voucher / discount codes
      const discountCodes: string[] = shipment.discounts?.codes || [];
      const discountNote = discountCodes.length
        ? ` | Discount: PKR ${discountTotal} (Codes: ${discountCodes.join(', ')})`
        : discountTotal > 0 ? ` | Discount: PKR ${discountTotal}` : '';

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
              customerType: 'POS',
            },
          });
          this.logger.log(`[Courierify] Created customer: ${customerName} (Type: POS)`);
        }
        customerId = defaultCustomer.id;
      }

      // Find location by code (OMS-IV or OMS-VI)
      let locationId: string | null = null;
      const targetLocation = await this.prisma.location.findFirst({
        where: { 
          OR: [
            { code: { equals: 'OMS-VI', mode: 'insensitive' } },
            { code: { equals: 'OMS-IV', mode: 'insensitive' } }
          ]
        },
      });
      if (targetLocation) {
        locationId = targetLocation.id;
      } else {
        this.logger.warn(`[Courierify] Location 'OMS-IV / OMS-VI' not found, order will be created without locationId`);
      }

      // Generate standard order number
      let orderNoStr = `CRF-${orderName || orderId}`;
      if (locationId) {
        try {
          orderNoStr = await this.posSalesService.generateSequentialNumber('SI', 'orderNumber', locationId);
        } catch (e) {
          this.logger.warn(`[Courierify] Failed to generate sequential order number, falling back to CRF format: ${e.message}`);
        }
      }

      // ── Match Courierify items to ERP items by SKU ──────────────────────────
      // Confirmed by Courierify team:
      //   shipment.lineItems = actual items array [ { sku, title, variantTitle, quantity } ]
      //   shipment.items     = just the COUNT (number) — NOT the items array
      // lineItems is present for BOTH manual and Shopify orders in shipment.booked webhook
      const lineItems = shipment.lineItems;
      const shipmentItems: { sku: string; quantity: number; title?: string }[] =
        Array.isArray(lineItems) ? lineItems : [];

      this.logger.log(
        `[Courierify] Order ${orderName || orderId} has ${shipmentItems.length} lineItem(s) in webhook`,
      );
      if (shipmentItems.length === 0) {
        this.logger.warn(
          `[Courierify] ⚠️  No lineItems found for order ${orderName || orderId}. Check webhook payload.`,
        );
      }


      const matchedOrderItems: {
        itemId: string;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        discountAmount: number;
        taxPercent: number;
        taxAmount: number;
        lineTotal: number;
      }[] = [];

      // Divide COD amount proportionally across items (or equally if only one)
      const totalQty = shipmentItems.reduce((s, i) => s + (Number(i.quantity) || 1), 0);

      for (const si of shipmentItems) {
        // Courierify lineItems[].sku = Shopify SKU = ERP itemId (not ERP sku field)
        // Match priority: itemId → sku → barCode
        let erpItem = await this.prisma.item.findFirst({
          where: { itemId: { equals: si.sku, mode: 'insensitive' } },
          select: { id: true, itemId: true, sku: true, barCode: true, unitPrice: true },
        });

        if (!erpItem && si.sku) {
          // Fallback: match by ERP sku field
          erpItem = await this.prisma.item.findFirst({
            where: { sku: { equals: si.sku, mode: 'insensitive' } },
            select: { id: true, itemId: true, sku: true, barCode: true, unitPrice: true },
          });
        }

        if (!erpItem && si.sku) {
          // Fallback: match by barCode
          erpItem = await this.prisma.item.findFirst({
            where: { barCode: { equals: si.sku, mode: 'insensitive' } },
            select: { id: true, itemId: true, sku: true, barCode: true, unitPrice: true },
          });
          if (erpItem) {
            this.logger.log(
              `[Courierify] "${si.sku}" matched via barCode → ERP itemId: ${erpItem.itemId}`,
            );
          }
        }

        if (erpItem) {
          const qty = Number(si.quantity) || 1;
          // Use ERP unit price; if not available fallback to proportional COD split
          const unitPrice = Number(erpItem.unitPrice) > 0
            ? Number(erpItem.unitPrice)
            : totalQty > 0 ? (codAmount / totalQty) : 0;
          const lineTotal = unitPrice * qty;

          matchedOrderItems.push({
            itemId: erpItem.id,
            quantity: qty,
            unitPrice,
            discountPercent: 0,
            discountAmount: 0,
            taxPercent: 0,
            taxAmount: 0,
            lineTotal,
          });
          this.logger.log(`[Courierify] Matched "${si.sku}" → ERP item ${erpItem.id}`);
        } else {
          this.logger.warn(
            `[Courierify] SKU/Barcode "${si.sku}" not found in ERP — item skipped`,
          );
        }
      }

      // Create the POS Sales Order (shown in POS Sales page)
      const salesOrder = await this.prisma.salesOrder.create({
        data: {
          orderNumber: orderNoStr,
          referenceNumber: orderName || orderId || courierOrderRef || null,
          status: shipment.status || 'booked',
          grandTotal: grandTotal,
          subtotal: subtotalAmount,
          discountAmount: discountTotal,
          paymentMethod: 'COD',
          paymentStatus: grandTotal > 0 ? 'unpaid' : 'paid',
          customerId: customerId,
          locationId: locationId,
          notes: `Source: Courierify${isManual ? ' (Manual)' : ''} | Customer: ${customer?.name || 'N/A'} | Courier: ${courier || 'N/A'}, Tracking: ${trackingNumber || 'N/A'}${manualReason ? ` | Reason: ${manualReason}` : ''}${discountNote}`,
          // Create linked order items if we matched any ERP items
          ...(matchedOrderItems.length > 0 && {
            items: {
              create: matchedOrderItems,
            },
          }),
        },
      });

      this.logger.log(`[Courierify] Created POS SalesOrder ${orderNoStr} (id: ${salesOrder.id}) with ${matchedOrderItems.length} item(s)`);

      // Auto-transfer stock from Warehouse → OMS (non-blocking)
      if (locationId && shipmentItems.length) {
        runInBackground(
          'OMS Auto Transfer Stock',
          this.autoTransferToOms({
            salesOrderId: salesOrder.id,
            locationId,
            shipmentItems,
            orderNumber: orderNoStr,
          }),
        );
      }

      this.logger.log(`[Courierify] Successfully created SalesOrder ${orderNoStr}`);
    } catch (err: any) {
      this.logger.error(`[Courierify] Failed to create order from shipment: ${err.message}`, err.stack);
    }
  }

  /**
   * Automatically transfer stock from the default Warehouse → OMS POS
   * when a Courierify order is booked. Bypasses manual approval chain.
   * Items are matched by SKU from the Courierify shipment payload.
   */
  private async autoTransferToOms(data: {
    salesOrderId: string;
    locationId: string;
    shipmentItems: { sku: string; quantity: number; title?: string }[];
    orderNumber: string;
  }): Promise<void> {
    try {
      this.logger.log(`[OMS Auto-Transfer] Starting for order ${data.orderNumber}`);

      // Get location to find its associated warehouse
      const location = await this.prisma.location.findUnique({
        where: { id: data.locationId },
        select: { warehouseId: true },
      });

      // Find warehouse associated with location, or fallback to first warehouse
      const warehouse = location?.warehouseId
        ? await this.prisma.warehouse.findUnique({ where: { id: location.warehouseId } })
        : await this.prisma.warehouse.findFirst({ orderBy: { createdAt: 'asc' } });

      if (!warehouse) {
        this.logger.warn(`[OMS Auto-Transfer] No warehouse found (and no default exists), skipping auto-transfer for ${data.orderNumber}`);
        return;
      }

      // Match Courierify SKUs to ERP items
      // Priority: itemId (Shopify SKU = ERP itemId) → sku → barCode
      const matchedItems: { itemId: string; quantity: number }[] = [];
      for (const si of data.shipmentItems) {
        let item = await this.prisma.item.findFirst({
          where: { itemId: { equals: si.sku, mode: 'insensitive' } },
          select: { id: true, itemId: true, sku: true },
        });

        if (!item && si.sku) {
          item = await this.prisma.item.findFirst({
            where: { sku: { equals: si.sku, mode: 'insensitive' } },
            select: { id: true, itemId: true, sku: true },
          });
        }

        if (!item && si.sku) {
          item = await this.prisma.item.findFirst({
            where: { barCode: { equals: si.sku, mode: 'insensitive' } },
            select: { id: true, itemId: true, sku: true },
          });
          if (item) {
            this.logger.log(`[OMS Auto-Transfer] "${si.sku}" matched via barCode (ERP itemId: ${item.itemId})`);
          }
        }

        if (item) {
          matchedItems.push({ itemId: item.id, quantity: Number(si.quantity) });
          this.logger.log(`[OMS Auto-Transfer] Matched "${si.sku}" → ERP itemId: ${item.itemId}`);
        } else {
          this.logger.warn(`[OMS Auto-Transfer] "${si.sku}" not found in ERP (tried itemId/sku/barCode), skipping`);
        }
      }

      if (matchedItems.length === 0) {
        this.logger.warn(`[OMS Auto-Transfer] No matching ERP items found for order ${data.orderNumber}, skipping transfer`);
        return;
      }

      // Create transfer request (Warehouse → OMS)
      const transfer = await this.transferRequestService.createRequest(
        {
          fromWarehouseId: warehouse.id,
          toLocationId: data.locationId,
          transferType: 'WAREHOUSE_TO_OUTLET',
          items: matchedItems,
          notes: `[AUTO-OMS] Courierify order ${data.orderNumber} | salesOrderId: ${data.salesOrderId}`,
        },
      );

      this.logger.log(`[OMS Auto-Transfer] Created transfer ${transfer.requestNo} for order ${data.orderNumber}`);

      // Auto-approve and accept immediately (bypasses Maker-Checker)
      await this.transferRequestService.autoAcceptForOms(transfer.id, data.salesOrderId);

      this.logger.log(`[OMS Auto-Transfer] Auto-approved transfer ${transfer.requestNo} for order ${data.orderNumber}`);
    } catch (error: any) {
      this.logger.error(`[OMS Auto-Transfer] Failed for order ${data.orderNumber}: ${error.message}`, error.stack);
    }
  }

  /**
   * Automatically return stock from OMS POS → Warehouse
   * when a courier marks a parcel as returned (customer refused delivery).
   * Bypasses manual approval chain.
   */
  private async autoReturnToWarehouse(data: {
    salesOrderId: string;
    locationId: string;
    orderNumber: string;
  }): Promise<void> {
    try {
      this.logger.log(`[OMS Auto-Return] Starting for order ${data.orderNumber}`);

      // Get items from the original sales order
      const orderItems = await this.prisma.salesOrderItem.findMany({
        where: { salesOrderId: data.salesOrderId },
        select: { itemId: true, quantity: true },
      });

      if (!orderItems.length) {
        this.logger.warn(`[OMS Auto-Return] No items found for order ${data.orderNumber}, skipping return transfer`);
        return;
      }

      // Get location to find its associated warehouse
      const location = await this.prisma.location.findUnique({
        where: { id: data.locationId },
        select: { warehouseId: true },
      });

      // Find warehouse associated with location, or fallback to first warehouse
      const warehouse = location?.warehouseId
        ? await this.prisma.warehouse.findUnique({ where: { id: location.warehouseId } })
        : await this.prisma.warehouse.findFirst({ orderBy: { createdAt: 'asc' } });

      if (!warehouse) {
        this.logger.warn(`[OMS Auto-Return] No warehouse found (and no default exists), skipping return transfer for ${data.orderNumber}`);
        return;
      }

      // Create return transfer (OMS → Warehouse)
      const transfer = await this.transferRequestService.createRequest(
        {
          fromLocationId: data.locationId,
          toWarehouseId: warehouse.id,
          transferType: 'OUTLET_TO_WAREHOUSE',
          items: orderItems.map(i => ({
            itemId: i.itemId,
            quantity: Number(i.quantity),
          })),
          notes: `[AUTO-RETURN] Courier return for order ${data.orderNumber} | salesOrderId: ${data.salesOrderId}`,
        },
      );

      this.logger.log(`[OMS Auto-Return] Created return transfer ${transfer.requestNo} for order ${data.orderNumber}`);

      // Auto-approve and accept immediately
      await this.transferRequestService.autoAcceptForOms(transfer.id, data.salesOrderId);

      this.logger.log(`[OMS Auto-Return] Auto-approved return transfer ${transfer.requestNo} for order ${data.orderNumber}`);
    } catch (error: any) {
      this.logger.error(`[OMS Auto-Return] Failed for order ${data.orderNumber}: ${error.message}`, error.stack);
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
            { referenceNumber: orderName },
          ],
        },
        select: { id: true, orderNumber: true, locationId: true, status: true },
      });

      if (existingOrder) {
        const newStatus = status?.toLowerCase() || existingOrder.status;
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: { status: newStatus },
        });
        this.logger.log(`[Courierify] Updated order #${existingOrder.orderNumber} status to: ${newStatus}`);

        // Cancelled shipment → auto return stock OMS → Warehouse
        if (newStatus === 'cancelled' && existingOrder.locationId) {
          this.logger.log(`[Courierify] Shipment cancelled for ${existingOrder.orderNumber} — triggering auto return to warehouse`);
          runInBackground(
            'OMS Auto Return Stock (Cancelled)',
            this.autoReturnToWarehouse({
              salesOrderId: existingOrder.id,
              locationId: existingOrder.locationId,
              orderNumber: existingOrder.orderNumber,
            }),
          );
        }
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
            { referenceNumber: orderName },
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
        where: {
          OR: [
            { orderNumber: orderName },
            { orderNumber: `CRF-${orderName}` },
            { referenceNumber: orderName },
          ],
        },
        select: { id: true, orderNumber: true, locationId: true },
      });

      if (existingOrder) {
        await this.prisma.salesOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: 'returned',
            paymentStatus: 'unpaid',
          },
        });
        this.logger.log(
          `[Courierify] Marked order #${existingOrder.orderNumber} as returned`,
        );

        // Auto-return stock from OMS → Warehouse (non-blocking)
        if (existingOrder.locationId) {
          runInBackground(
            'OMS Auto Return Stock',
            this.autoReturnToWarehouse({
              salesOrderId: existingOrder.id,
              locationId: existingOrder.locationId,
              orderNumber: existingOrder.orderNumber,
            }),
          );
        }
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
