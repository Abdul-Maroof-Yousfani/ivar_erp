import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../database/prisma.service';
import { UploadEventsService } from '../finance/item/upload-events.service';
import { BaseBulkUploadService } from '../common/services/base-bulk-upload.service';

@Injectable()
export class OnlineSalesBulkUploadService extends BaseBulkUploadService {
    constructor(
        @InjectQueue('online-sales-upload') uploadQueue: Queue,
        prisma: PrismaService,
        eventsService: UploadEventsService,
    ) {
        super(uploadQueue, prisma, eventsService, 'online-sales');
    }

    /**
     * Process direct JSON Shopify payload via bulk pipeline
     */
    async processJsonPayload(payload: any, userId: string) {
        const jsonBuffer = Buffer.from(JSON.stringify(payload), 'utf-8');
        const filename = `shopify-upload-${Date.now()}.json`;

        return this.initiateValidation(
            jsonBuffer,
            filename,
            userId,
        );
    }
}
