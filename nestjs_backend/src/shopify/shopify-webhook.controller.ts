import {
  Controller,
  Post,
  Get,
  Query,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ShopifyService } from './shopify.service';
import { PrismaService } from '../database/prisma.service';
import { runInBackground } from '../common/utils/run-in-background.util';

/**
 * ShopifyController
 *
 * Handles all Shopify-facing routes:
 *
 * GET  /shopify/auth/callback  — OAuth redirect handler (required by Shopify app config)
 * GET  /shopify/status         — Quick health check to confirm credentials are set
 * POST /shopify/webhook        — Inbound webhook for orders/paid
 *                                (ONLY used to detect voucher redemption on Shopify website)
 *
 * NOTE: Order sync/fulfillment is handled entirely by Courierify.
 *       Shopify integration here is ONLY for discount voucher management.
 */
@ApiTags('Shopify')
@Controller('shopify')
export class ShopifyWebhookController {
  private readonly logger = new Logger(ShopifyWebhookController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly prisma: PrismaService,
  ) {}

  // ── OAuth Callback (GET /shopify/auth/callback) ──────────────────────────
  // Shopify redirects here after app install/auth.
  // Since we use a static Access Token (already have it from app install),
  // this endpoint just acknowledges the redirect.
  @Get('auth/callback')
  @ApiOperation({ summary: 'Shopify OAuth callback (app install redirect)' })
  @ApiQuery({ name: 'shop', required: false })
  @ApiQuery({ name: 'code', required: false })
  async authCallback(
    @Query('shop') shop?: string,
    @Query('code') code?: string,
    @Query('hmac') hmac?: string,
  ) {
    this.logger.log(`[Shopify OAuth] Callback received — shop: ${shop}, code: ${code ? '***' : 'none'}`);
    // Static token flow: no code exchange needed.
    // If full OAuth flow is needed in future, exchange `code` for access token here.
    return {
      status: 'ok',
      message: 'Shopify app callback received. Integration uses static access token.',
      shop: shop ?? 'unknown',
    };
  }

  // ── Status check (GET /shopify/status) ───────────────────────────────────
  @Get('status')
  @ApiOperation({ summary: 'Check Shopify integration credentials are configured' })
  async status() {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
    const hasToken = !!process.env.SHOPIFY_API_KEY && !!process.env.SHOPIFY_API_SECRET;
    const hasWebhookSecret = !!process.env.SHOPIFY_WEBHOOK_SECRET;
    return {
      configured: !!shopDomain && hasToken,
      shopDomain: shopDomain || 'NOT SET',
      authMethod: hasToken ? 'client_credentials grant (SET ✓)' : 'MISSING API KEY OR SECRET ✗',
      webhookSecret: hasWebhookSecret ? 'SET ✓' : 'MISSING ✗',
      apiVersion: process.env.SHOPIFY_API_VERSION || '2026-10',
      purpose: 'Discount voucher sync only (orders handled by Courierify)',
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify inbound webhook receiver (orders/paid)' })
  async handleWebhook(
    @Req() req: any,
    @Headers('x-shopify-hmac-sha256') hmacHeader?: string,
    @Headers('x-shopify-topic') topic?: string,
    @Headers('x-shopify-shop-domain') shopDomain?: string,
  ) {
    this.logger.log(`[Shopify Webhook] Topic: ${topic}, Shop: ${shopDomain}`);

    // Extract raw body for HMAC verification
    let rawBody: string | Buffer = '';
    if ((req as any).rawBody) {
      rawBody = (req as any).rawBody;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body || {});
    }

    // Verify Shopify HMAC signature (base64 SHA-256)
    const isValid = this.shopifyService.verifyWebhookHmac(rawBody, hmacHeader || '');
    if (!isValid) {
      this.logger.warn('[Shopify Webhook] Invalid HMAC signature -- rejecting');
      throw new UnauthorizedException('Invalid Shopify webhook signature');
    }

    const payload =
      typeof req.body === 'object' && req.body !== null
        ? req.body
        : JSON.parse(rawBody.toString('utf8'));

    // Tenant context from query params injected by middleware
    const tenantCtx = (req as any).tenantId
      ? {
          tenantId: (req as any).tenantId,
          companyId: (req as any).companyId,
          dbUrl: (req as any).tenantDbUrl,
        }
      : null;

    // Return 200 immediately; process async in background
    setImmediate(() => {
      const runner = () => {
        this.processWebhook(topic || '', payload).catch((err) => {
          this.logger.error(
            `[Shopify Webhook] Error processing topic ${topic}: ${err.message}`,
            err.stack,
          );
        });
      };

      if (tenantCtx?.dbUrl) {
        PrismaService.asyncLocalStorage.run(tenantCtx, runner);
      } else {
        runner();
      }
    });

    return { status: 'success', receivedAt: new Date().toISOString() };
  }

  // ── Route webhook to correct handler by topic ─────────────────────────────
  private async processWebhook(topic: string, payload: any): Promise<void> {
    switch (topic) {
      case 'orders/paid':
      case 'orders/create':
        await this.handleOrderWebhook(payload, topic);
        break;
      default:
        this.logger.log(`[Shopify Webhook] Unhandled topic: ${topic} -- ignoring`);
    }
  }

  // ── orders/create or orders/paid: mark voucher as REDEEMED_ONLINE ──
  private async handleOrderWebhook(payload: any, topic: string): Promise<void> {
    const shopifyOrderId = String(payload?.id || '');
    const discountCodes = this.shopifyService.extractDiscountCodesFromOrder(payload);

    if (discountCodes.length === 0) {
      this.logger.log(
        `[Shopify ${topic}] Order ${shopifyOrderId} -- no ERP discount codes, skipping`,
      );
      return;
    }

    this.logger.log(
      `[Shopify ${topic}] Order ${shopifyOrderId} -- codes: ${discountCodes.join(', ')}`,
    );

    for (const code of discountCodes) {
      runInBackground(
        `Shopify redeem ${code}`,
        (async () => {
        const voucher = await this.prisma.voucher.findFirst({
          where: { code, isDeleted: false },
        });

        if (!voucher) {
          this.logger.warn(`[Shopify orders/paid] No ERP voucher found for code: ${code}`);
          return;
        }

        if (voucher.isRedeemed) {
          this.logger.warn(`[Shopify orders/paid] Voucher ${code} already redeemed -- skipping`);
          return;
        }

        // Mark voucher as redeemed
        await this.prisma.voucher.update({
          where: { id: voucher.id },
          data: {
            isRedeemed: true,
            isActive: false,
            shopifySyncStatus: 'REDEEMED_ONLINE',
          },
        });

        // Audit trail
        await this.prisma.voucherTransaction.create({
          data: {
            voucherId: voucher.id,
            action: 'REDEEMED_ONLINE',
            amountUsed: voucher.faceValue,
            notes: `Redeemed on Shopify -- Order ID: ${shopifyOrderId}`,
          },
        });

        this.logger.log(
          `[Shopify ${topic}] Voucher ${code} -> REDEEMED_ONLINE (Shopify Order: ${shopifyOrderId})`,
        );
      })(),
      );
    }
  }
}

