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

  // ── orders/create or orders/paid: partial or full voucher redemption ──
  private async handleOrderWebhook(payload: any, topic: string): Promise<void> {
    const shopifyOrderId = String(payload?.id || '');
    const discountCodes = this.shopifyService.extractDiscountCodesFromOrder(payload);

    if (discountCodes.length === 0) {
      this.logger.log(
        `[Shopify ${topic}] Order ${shopifyOrderId} -- no ERP discount codes, skipping`,
      );
      return;
    }

    // Extract actual per-code discount amounts from Shopify payload.
    // For line_item-scoped discounts, DC is excluded automatically.
    const discountAmountMap = this.shopifyService.extractDiscountAmounts(payload);

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
            this.logger.warn(`[Shopify orders/paid] Voucher ${code} already fully redeemed -- skipping`);
            return;
          }

          // Use actual Shopify discount amount (item total only — DC excluded by target_type: line_item).
          // Fall back to remainingBalance if Shopify didn't send amount (shouldn't happen).
          const currentBalance = Number((voucher as any).remainingBalance ?? voucher.faceValue);
          const shopifyActualAmount = discountAmountMap[code];
          const amountToDeduct = shopifyActualAmount !== undefined
            ? Math.min(shopifyActualAmount, currentBalance)
            : currentBalance; // fallback: treat as full balance use

          const newBalance = parseFloat((currentBalance - amountToDeduct).toFixed(2));
          const isFullyRedeemed = newBalance <= 0;

          // Idempotency: check if this order was already processed for this voucher
          const existingRedemption = await this.prisma.voucherTransaction.findFirst({
            where: {
              voucherId: voucher.id,
              notes: { contains: shopifyOrderId },
              action: { in: ['REDEEMED_ONLINE', 'PARTIAL_REDEEMED_ONLINE'] },
            },
          });
          if (existingRedemption) {
            this.logger.warn(
              `[Shopify ${topic}] Voucher ${code} already processed for Shopify Order ${shopifyOrderId} -- skipping duplicate webhook`,
            );
            return;
          }

          // Always mark original voucher as redeemed
          await this.prisma.voucher.update({
            where: { id: voucher.id },
            data: {
              remainingBalance: 0,
              isRedeemed: true,
              isActive: false,
              shopifySyncStatus: 'REDEEMED_ONLINE',
              shopifySyncedAt: new Date(),
            },
          });

          // Audit trail
          await this.prisma.voucherTransaction.create({
            data: {
              voucherId: voucher.id,
              action: 'REDEEMED_ONLINE',
              amountUsed: amountToDeduct,
              notes: newBalance > 0
                ? `Redeemed on Shopify -- Order ID: ${shopifyOrderId}. Used: Rs ${amountToDeduct}. Remaining balance: Rs ${newBalance}`
                : `Fully redeemed on Shopify -- Order ID: ${shopifyOrderId}`,
            },
          });

          // Expire original PriceRule on Shopify
          if ((voucher as any).shopifyPriceRuleId) {
            await this.shopifyService.expirePriceRule((voucher as any).shopifyPriceRuleId).catch(err => {
              this.logger.error(`Failed to expire redeemed voucher ${code}: ${err.message}`);
            });
          } else {
            await this.shopifyService.expirePriceRuleByCode(code).catch(err => {
              this.logger.error(`Failed to expire redeemed voucher ${code} by code: ${err.message}`);
            });
          }

          // If remaining balance > 0: AUTOMATICALLY GENERATE NEW CREDIT VOUCHER FOR CUSTOMER!
          if (newBalance > 0) {
            const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
            const newCode = `CRD-${rand}`;
            const expiresAt = undefined; // Credit vouchers do not expire

            const creditVoucher = await this.prisma.voucher.create({
              data: {
                code: newCode,
                voucherType: 'CREDIT',
                faceValue: newBalance,
                remainingBalance: newBalance,
                description: `Credit voucher for unused balance of ${voucher.code}`,
                customerId: voucher.customerId,
                issuedByLocationId: voucher.issuedByLocationId,
                expiresAt: null,
                isActive: true,
                isRedeemed: false,
                transactions: {
                  create: {
                    action: 'ISSUED',
                    amountUsed: 0,
                    notes: `Credit voucher issued for unused balance of ${voucher.code} (Shopify Order ${shopifyOrderId})`,
                  },
                },
              },
            });
            this.logger.log(`[Shopify ${topic}] Created new Credit Voucher ${newCode} for remaining balance Rs ${newBalance}`);

            // Push new credit voucher to Shopify so customer can immediately use it online!
            try {
              const pushRes = await this.shopifyService.pushVoucherToShopify({
                id: creditVoucher.id,
                code: creditVoucher.code,
                voucherType: 'CREDIT',
                faceValue: newBalance,
                expiresAt,
              });
              if (pushRes.success) {
                await this.prisma.voucher.update({
                  where: { id: creditVoucher.id },
                  data: {
                    shopifyPriceRuleId: pushRes.priceRuleId,
                    shopifyDiscountId: pushRes.discountCodeId,
                    shopifySyncStatus: 'SYNCED',
                    shopifySyncedAt: new Date(),
                  },
                });
                this.logger.log(`[Shopify ${topic}] Pushed new Credit Voucher ${newCode} to Shopify`);
              }
            } catch (err) {
              this.logger.error(`Failed to push new Credit Voucher ${newCode} to Shopify: ${err.message}`);
            }
          }

          this.logger.log(
            `[Shopify ${topic}] Voucher ${code} -- ${isFullyRedeemed ? 'FULLY REDEEMED' : `PARTIAL (Rs ${amountToDeduct} used, Rs ${newBalance} remaining)`} (Shopify Order: ${shopifyOrderId})`,
          );
        })(),
      );
    }
  }
}
