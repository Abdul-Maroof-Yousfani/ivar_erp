import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
  private readonly clientId = process.env.SHOPIFY_API_KEY || '';
  private readonly clientSecret = process.env.SHOPIFY_API_SECRET || '';
  private readonly apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';
  private readonly webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  private readonly SYNCABLE_TYPES = ['EXCHANGE', 'GIFT', 'CREDIT'];

  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  private get baseUrl(): string {
    return 'https://' + this.shopDomain + '/admin/api/' + this.apiVersion;
  }

  // Fetch access token via client_credentials grant
  private async getAccessToken(): Promise<string> {
    // Return cached token if valid (with 1 min buffer)
    if (this.cachedAccessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    if (!this.clientId || !this.clientSecret || !this.shopDomain) {
      throw new Error('Missing Shopify API credentials in environment.');
    }

    const tokenUrl = 'https://' + this.shopDomain + '/admin/oauth/access_token';
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error('[Shopify] Failed to fetch access token: ' + err);
      throw new Error('Failed to authenticate with Shopify: ' + err);
    }

    const data: any = await response.json();
    this.cachedAccessToken = data.access_token;
    // Default to 24h if expires_in is somehow missing
    const expiresInSec = data.expires_in || 86400; 
    this.tokenExpiresAt = Date.now() + (expiresInSec * 1000);

    this.logger.log('[Shopify] Successfully fetched new client_credentials access token.');
    return this.cachedAccessToken!;
  }

  verifyWebhookHmac(rawBody: string | Buffer, hmacHeader: string): boolean {
    if (!this.webhookSecret || !hmacHeader) return false;
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const computed = crypto.createHmac('sha256', this.webhookSecret).update(bodyStr, 'utf8').digest('base64');
    try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader)); }
    catch { return false; }
  }

  async pushVoucherToShopify(voucher: {
    id: string; code: string; voucherType: string; faceValue: number; expiresAt?: Date | null;
  }): Promise<{ success: boolean; priceRuleId?: string; discountCodeId?: string; error?: string }> {
    if (!this.SYNCABLE_TYPES.includes(voucher.voucherType)) return { success: false, error: 'NOT_SYNCABLE_TYPE' };
    if (!this.shopDomain) {
      this.logger.warn('[Shopify] Missing shop domain - skipping push');
      return { success: false, error: 'MISSING_CREDENTIALS' };
    }
    try {
      const token = await this.getAccessToken();

      // Format expiry date safely (if date only was picked, extend to 23:59:59 end-of-day)
      let endsAt: string | undefined = undefined;
      if (voucher.expiresAt) {
        const d = voucher.expiresAt instanceof Date ? new Date(voucher.expiresAt.getTime()) : new Date(voucher.expiresAt);
        if (!isNaN(d.getTime())) {
          if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
            d.setUTCHours(23, 59, 59, 999);
          }
          endsAt = d.toISOString();
        }
      }

      const priceRuleRes = await fetch(this.baseUrl + '/price_rules.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({
          price_rule: {
            title: 'POS-VOUCHER-' + voucher.code,
            value_type: 'fixed_amount',
            value: '-' + voucher.faceValue.toFixed(2),
            customer_selection: 'all',
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            starts_at: new Date().toISOString(),
            ...(endsAt ? { ends_at: endsAt } : {}),
            usage_limit: 1,
            once_per_customer: false,
          },
        }),
      });
      if (!priceRuleRes.ok) {
        const errText = await priceRuleRes.text();
        this.logger.error('[Shopify] PriceRule failed for ' + voucher.code + ': ' + errText);
        return { success: false, error: 'PriceRule failed: ' + errText };
      }
      const priceRuleData: any = await priceRuleRes.json();
      const priceRuleId = String(priceRuleData.price_rule.id);
      this.logger.log('[Shopify] PriceRule created: ' + priceRuleId + ' for ' + voucher.code);

      const discountCodeRes = await fetch(
        this.baseUrl + '/price_rules/' + priceRuleId + '/discount_codes.json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
          body: JSON.stringify({ discount_code: { code: voucher.code } }),
        },
      );
      if (!discountCodeRes.ok) {
        const errText = await discountCodeRes.text();
        this.logger.error('[Shopify] DiscountCode failed for ' + voucher.code + ': ' + errText);
        await this.deletePriceRule(priceRuleId).catch(() => {});
        return { success: false, error: 'DiscountCode failed: ' + errText };
      }
      const discountCodeData: any = await discountCodeRes.json();
      const discountCodeId = String(discountCodeData.discount_code.id);
      this.logger.log('[Shopify] DiscountCode created: ' + discountCodeId + ' for ' + voucher.code);
      return { success: true, priceRuleId, discountCodeId };
    } catch (err: any) {
      this.logger.error('[Shopify] Unexpected error for ' + voucher.code + ': ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  async deletePriceRule(priceRuleId: string): Promise<boolean> {
    if (!priceRuleId || !this.shopDomain) return false;
    try {
      const token = await this.getAccessToken();

      // SAFETY GUARD: Check PriceRule title on Shopify before deleting.
      // Must start with POS-VOUCHER- to guarantee we NEVER delete store promotional discounts.
      const verifyRes = await fetch(`${this.baseUrl}/price_rules/${priceRuleId}.json`, {
        headers: { 'X-Shopify-Access-Token': token },
      });
      if (verifyRes.ok) {
        const verifyData: any = await verifyRes.json();
        const prTitle = String(verifyData?.price_rule?.title || '');
        if (!prTitle.startsWith('POS-VOUCHER-')) {
          this.logger.warn(
            `[Shopify Safety Guard] Refusing to delete PriceRule ${priceRuleId} ("${prTitle}"): title does NOT start with "POS-VOUCHER-". Protecting store promo discounts!`,
          );
          return false;
        }
      }

      const res = await fetch(this.baseUrl + '/price_rules/' + priceRuleId + '.json', {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': token },
      });
      this.logger.log('[Shopify] PriceRule ' + priceRuleId + ' deleted (status: ' + res.status + ')');
      return res.ok || res.status === 404;
    } catch (err: any) {
      this.logger.error('[Shopify] Failed to delete PriceRule ' + priceRuleId + ': ' + err.message);
      return false;
    }
  }

  async deletePriceRuleByCode(code: string): Promise<boolean> {
    if (!code || !this.shopDomain) return false;

    // SAFETY GUARD: Only allow deleting POS-issued vouchers with known prefixes
    const voucherPrefixRegex = /^(GFT|EXC|CRD|CRP|OGT|RFD|SHP)-/i;
    const cleanCode = code.trim().toUpperCase();
    if (!voucherPrefixRegex.test(cleanCode)) {
      this.logger.warn(
        `[Shopify Safety Guard] Refusing to delete non-voucher code "${cleanCode}". General promotional discounts must remain untouched!`,
      );
      return false;
    }

    try {
      const token = await this.getAccessToken();

      // Method 1: Lookup via discount_codes lookup endpoint
      try {
        const lookupRes = await fetch(
          `${this.baseUrl}/discount_codes/lookup.json?code=${encodeURIComponent(cleanCode)}`,
          {
            headers: { 'X-Shopify-Access-Token': token },
            redirect: 'manual',
          },
        );

        const location = lookupRes.headers.get('location');
        if (location) {
          const match = location.match(/\/price_rules\/(\d+)/);
          if (match && match[1]) {
            this.logger.log(`[Shopify] Found PriceRule ${match[1]} for discount code ${cleanCode} via lookup`);
            return await this.deletePriceRule(match[1]);
          }
        }
      } catch (lookupErr: any) {
        this.logger.debug(`[Shopify] Discount lookup error: ${lookupErr.message}`);
      }

      // Method 2: Search recent price rules by exact title POS-VOUCHER-<code>
      const res = await fetch(`${this.baseUrl}/price_rules.json?limit=50`, {
        headers: { 'X-Shopify-Access-Token': token },
      });
      if (res.ok) {
        const data: any = await res.json();
        const priceRules: any[] = data.price_rules || [];
        const target = priceRules.find(
          (pr: any) => pr.title === `POS-VOUCHER-${cleanCode}`,
        );
        if (target) {
          this.logger.log(`[Shopify] Found PriceRule ${target.id} (${target.title}) for code ${cleanCode}`);
          return await this.deletePriceRule(String(target.id));
        }
      }

      return false;
    } catch (err: any) {
      this.logger.error(`[Shopify] Failed to delete PriceRule by code ${code}: ${err.message}`);
      return false;
    }
  }

  async expirePriceRule(priceRuleId: string): Promise<boolean> {
    if (!priceRuleId || !this.shopDomain) return false;
    try {
      const token = await this.getAccessToken();

      // SAFETY GUARD: Check PriceRule title on Shopify before expiring.
      // Must start with POS-VOUCHER- to guarantee we NEVER touch store promotional discounts (e.g. IVAR10).
      const verifyRes = await fetch(`${this.baseUrl}/price_rules/${priceRuleId}.json`, {
        headers: { 'X-Shopify-Access-Token': token },
      });
      if (verifyRes.ok) {
        const verifyData: any = await verifyRes.json();
        const prTitle = String(verifyData?.price_rule?.title || '');
        if (!prTitle.startsWith('POS-VOUCHER-')) {
          this.logger.warn(
            `[Shopify Safety Guard] Refusing to expire PriceRule ${priceRuleId} ("${prTitle}"): title does NOT start with "POS-VOUCHER-". Protecting store promo discounts!`,
          );
          return false;
        }
      }

      const res = await fetch(`${this.baseUrl}/price_rules/${priceRuleId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({
          price_rule: {
            id: Number(priceRuleId),
            ends_at: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`[Shopify] Failed to expire PriceRule ${priceRuleId}: ${err}`);
        return false;
      }

      this.logger.log(`[Shopify] PriceRule ${priceRuleId} marked as EXPIRED (ends_at set)`);
      return true;
    } catch (err: any) {
      this.logger.error(`[Shopify] Error expiring PriceRule ${priceRuleId}: ${err.message}`);
      return false;
    }
  }

  async expirePriceRuleByCode(code: string): Promise<boolean> {
    if (!code || !this.shopDomain) return false;

    // SAFETY GUARD: Only allow expiring POS-issued vouchers with known prefixes
    const voucherPrefixRegex = /^(GFT|EXC|CRD|CRP|OGT|RFD|SHP)-/i;
    const cleanCode = code.trim().toUpperCase();
    if (!voucherPrefixRegex.test(cleanCode)) {
      this.logger.warn(
        `[Shopify Safety Guard] Refusing to expire non-voucher code "${cleanCode}". General promotional discounts must remain untouched!`,
      );
      return false;
    }

    try {
      const token = await this.getAccessToken();

      // Method 1: Lookup via discount_codes lookup endpoint
      try {
        const lookupRes = await fetch(
          `${this.baseUrl}/discount_codes/lookup.json?code=${encodeURIComponent(cleanCode)}`,
          {
            headers: { 'X-Shopify-Access-Token': token },
            redirect: 'manual',
          },
        );

        const location = lookupRes.headers.get('location');
        if (location) {
          const match = location.match(/\/price_rules\/(\d+)/);
          if (match && match[1]) {
            this.logger.log(`[Shopify] Found PriceRule ${match[1]} for voucher code ${cleanCode} via lookup. Expiring it.`);
            return await this.expirePriceRule(match[1]);
          }
        }
      } catch (lookupErr: any) {
        this.logger.debug(`[Shopify] Discount lookup error: ${lookupErr.message}`);
      }

      // Method 2: Search recent price rules by exact title POS-VOUCHER-<code>
      const res = await fetch(`${this.baseUrl}/price_rules.json?limit=50`, {
        headers: { 'X-Shopify-Access-Token': token },
      });
      if (res.ok) {
        const data: any = await res.json();
        const priceRules: any[] = data.price_rules || [];
        const target = priceRules.find(
          (pr: any) => pr.title === `POS-VOUCHER-${cleanCode}`,
        );
        if (target) {
          this.logger.log(`[Shopify] Found PriceRule ${target.id} (${target.title}) for code ${cleanCode}. Expiring it.`);
          return await this.expirePriceRule(String(target.id));
        }
      }

      return false;
    } catch (err: any) {
      this.logger.error(`[Shopify] Failed to expire PriceRule by code ${code}: ${err.message}`);
      return false;
    }
  }

  async updatePriceRuleExpiry(priceRuleId: string, expiresAt?: Date | string | null): Promise<boolean> {
    if (!priceRuleId || !this.shopDomain) return false;
    try {
      const token = await this.getAccessToken();
      let endsAt: string | null = null;
      if (expiresAt) {
        const d = expiresAt instanceof Date ? new Date(expiresAt.getTime()) : new Date(expiresAt);
        if (!isNaN(d.getTime())) {
          if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
            d.setUTCHours(23, 59, 59, 999);
          }
          endsAt = d.toISOString();
        }
      }

      const res = await fetch(`${this.baseUrl}/price_rules/${priceRuleId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({
          price_rule: {
            id: Number(priceRuleId),
            ends_at: endsAt,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`[Shopify] Failed to update PriceRule expiry ${priceRuleId}: ${err}`);
        return false;
      }

      this.logger.log(`[Shopify] PriceRule ${priceRuleId} expiry updated to ${endsAt || 'No expiry'}`);
      return true;
    } catch (err: any) {
      this.logger.error(`[Shopify] Error updating PriceRule expiry ${priceRuleId}: ${err.message}`);
      return false;
    }
  }

  extractDiscountCodesFromOrder(orderPayload: any): string[] {
    if (!Array.isArray(orderPayload?.discount_codes)) return [];
    return orderPayload.discount_codes
      .filter((dc: any) => dc?.code)
      .map((dc: any) => String(dc.code).toUpperCase().trim());
  }

  async getOrder(orderIdOrName: string): Promise<any> {
    if (!this.shopDomain) return null;
    try {
      const token = await this.getAccessToken();
      
      // If it's a GID, extract the numeric ID
      let numericId = orderIdOrName;
      if (orderIdOrName.includes('gid://shopify/Order/')) {
        numericId = orderIdOrName.split('/').pop() || '';
      }

      // If it's a name like "#124485", we have to search by name
      if (numericId.startsWith('#') || isNaN(Number(numericId))) {
        const res = await fetch(this.baseUrl + `/orders.json?name=${encodeURIComponent(numericId)}&status=any`, {
          headers: { 'X-Shopify-Access-Token': token },
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        return data.orders && data.orders.length > 0 ? data.orders[0] : null;
      }

      // Otherwise fetch by ID
      const res = await fetch(this.baseUrl + `/orders/${numericId}.json`, {
        headers: { 'X-Shopify-Access-Token': token },
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      return data.order;
    } catch (err: any) {
      this.logger.error(`[Shopify] Failed to fetch order ${orderIdOrName}: ${err.message}`);
      return null;
    }
  }
}