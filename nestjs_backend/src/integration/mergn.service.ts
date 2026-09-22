import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class MergnService {
  private readonly logger = new Logger(MergnService.name);

  @OnEvent('pos.order.created', { async: true })
  async handlePosOrderCreated(payload: {
    order: any;
    customer: any;
    items: any[];
    location: any;
  }) {
    const { order, customer, items, location } = payload;

    // We need a phone number to identify the customer
    const phone = customer?.phone || customer?.mobile || customer?.contactNo || customer?.contactNumber;
    if (!phone) {
      this.logger.debug('Skipping Mergn API integration: Customer has no phone number.');
      return;
    }

    try {
      await Promise.allSettled([
        this.recordEvent(phone, order, items, location),
        this.recordBulkAttribute(phone, customer)
      ]);
    } catch (error) {
      this.logger.error('Error during Mergn API integration', error);
    }
  }

  private async recordEvent(phone: string, order: any, items: any[], location: any) {
    const url = `${process.env.MERGN_API_URL}/v2/event/record-event`;
    const token = process.env.MERGN_API_TOKEN;

    if (!url || !token) {
      this.logger.warn('MERGN_API_URL or MERGN_API_TOKEN is not configured.');
      return;
    }

    // Mapping item fields into arrays as required
    const titles = items.map(i => i.item?.title || i.item?.description || i.itemTitle || '').filter(Boolean);
    const variants = items.map(i => i.item?.variant || i.item?.size?.name || i.item?.color?.name || i.variantName || '').filter(Boolean);
    const vendors = items.map(i => i.item?.vendor || i.item?.vendorName || i.vendorName || '').filter(Boolean);
    const types = items.map(i => i.item?.type || i.item?.category || i.itemType || '').filter(Boolean);

    const branchName = location?.name || 'IVAR POS';
    const totalPrice = Number(order.netTotal || order.grandTotal || order.totalAmount || 0);

    const body = {
      identity: phone,
      events: [
        {
          eventId: 3586, // Place Order
          sessionId: 'IVAR',
          eventProperties: [
            { eventPropertyId: 16003, value: titles },
            { eventPropertyId: 16009, value: variants },
            { eventPropertyId: 16005, value: vendors },
            { eventPropertyId: 15963, value: 'POS' },
            { eventPropertyId: 16002, value: totalPrice },
            { eventPropertyId: 16011, value: types },
            { eventPropertyId: 43903, value: branchName }
          ]
        }
      ]
    };

    this.logger.debug(`Mergn recordEvent payload for phone ${phone}: ${JSON.stringify(body, null, 2)}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Mergn recordEvent failed: ${response.status} - ${errText}`);
    } else {
      this.logger.log(`Mergn recordEvent successful for phone ${phone}`);
    }
  }

  private async recordBulkAttribute(phone: string, customer: any) {
    const url = `${process.env.MERGN_API_URL}/attribute/record-bulk-attribute`;
    const token = process.env.MERGN_API_TOKEN;

    if (!url || !token) {
      return;
    }

    const city = customer?.city || customer?.cityId || '';
    const email = customer?.email || '';
    const firstName = customer?.firstName || customer?.name || '';

    const attributes = [];
    if (city) attributes.push({ attributeId: 2234, value: city });
    if (email) attributes.push({ attributeId: 2242, value: email });
    if (firstName) attributes.push({ attributeId: 2238, value: firstName });

    const body = [
      {
        identity: phone,
        attributes
      }
    ];

    this.logger.debug(`Mergn recordBulkAttribute payload for phone ${phone}: ${JSON.stringify(body, null, 2)}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Mergn recordBulkAttribute failed: ${response.status} - ${errText}`);
    } else {
      this.logger.log(`Mergn recordBulkAttribute successful for phone ${phone}`);
    }
  }
}
