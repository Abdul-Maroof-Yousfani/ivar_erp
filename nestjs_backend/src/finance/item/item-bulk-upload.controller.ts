import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    UseGuards,
    Res,
    HttpStatus,
    BadRequestException,
    Req,
    Sse,
    MessageEvent,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ItemBulkUploadService } from './item-bulk-upload.service';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadEventsService } from './upload-events.service';
import { Observable } from 'rxjs';

@ApiTags('ERP Items Bulk Upload')
@Controller('api/items/bulk-upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ItemBulkUploadController {
    constructor(
        private bulkUploadService: ItemBulkUploadService,
        private eventsService: UploadEventsService,
    ) { }

    /**
     * POST /api/items/bulk-upload
     * Upload CSV/Excel file and initiate validation
     */
    @Post()
    @ApiOperation({ summary: 'Upload file for validation' })
    async uploadFile(
        @Req() req: any,
        @GetUser('id') userId: string,
    ) {
        const file = await req.file();
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        const allowedExtensions = ['csv', 'xlsx', 'xls'];
        const ext = file.filename.split('.').pop()?.toLowerCase();

        if (!ext || !allowedExtensions.includes(ext)) {
            throw new BadRequestException(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`);
        }

        const buffer = await file.toBuffer();
        const maxSize = 50 * 1024 * 1024; // Lowering to 50MB for better performance
        if (buffer.length > maxSize) {
            throw new BadRequestException('File size exceeds 50MB limit');
        }

        const result = await this.bulkUploadService.initiateValidation(
            buffer,
            file.filename,
            userId,
        );

        return {
            status: true,
            message: 'Validation initiated',
            data: result,
        };
    }

    /**
     * POST /api/items/bulk-upload/:uploadId/confirm
     * Confirm validation and start actual import
     */
    @Post(':uploadId/confirm')
    @ApiOperation({ summary: 'Confirm and start import of valid records' })
    async confirmUpload(
        @Param('uploadId') uploadId: string,
        @GetUser('id') userId: string,
    ) {
        const result = await this.bulkUploadService.confirmUpload(uploadId, userId);
        return {
            status: true,
            message: 'Import confirmed and started',
            data: result,
        };
    }

    /**
     * SSE /api/items/bulk-upload/:uploadId/events
     * Stream real-time progress events
     */
    @Sse(':uploadId/events')
    @ApiOperation({ summary: 'Stream bulk upload events (SSE)' })
    streamEvents(@Param('uploadId') uploadId: string): Observable<MessageEvent> {
        return this.eventsService.subscribe(uploadId);
    }

    /**
     * GET /api/items/bulk-upload/history
     */
    @Get('history/list')
    @ApiOperation({ summary: 'Get upload history' })
    async getUploadHistory(@GetUser('id') userId: string) {
        const history = await this.bulkUploadService.getUploadHistory(userId);
        return {
            status: true,
            data: history,
        };
    }

    @Get('template/download')
    @ApiOperation({ summary: 'Download CSV template' })
    async downloadTemplate(@Res() res: any) {
        const template = [
            // Brand/Concept is hardcoded to "IVAR" in the backend now.
            // ItemID is optional (if provided, row will target update-by-itemId; if omitted, a new itemId is generated).
            'Category,Sub Category,Channel Class,Gender,Season,SKU,BarCode,Description,ImageUrl,UnitPrice,UnitCost,FOB,TaxRate1,TaxRate2,DiscountRate,DiscountAmount,DiscountStartDate,DiscountEndDate,IsActive,HSCode,Size,Color,Silhouette,ItemID',
            // Sample items (clothing) — ItemID blank means "create new"
            'Tops,T-Shirts,MONO,Men,Summer 2026,IVAR-M-TS-001,IVAR000000001,Cotton Crewneck T-Shirt,,1499,800,0,5,0,0,0,,,true,610910,S,Black,Regular Fit,',
            'Tops,Polos,MULTI,Men,Summer 2026,IVAR-M-PO-002,IVAR000000002,Pique Polo Shirt,,2499,1400,0,5,0,0,0,,,true,610510,M,Navy,Slim Fit,',
            'Bottoms,Jeans,MONO,Men,All Season,IVAR-M-JE-003,IVAR000000003,Straight Fit Denim Jeans,,3999,2400,0,5,0,0,0,,,true,620342,32,Blue,Straight,',
            'Outerwear,Hoodies,MULTI,Men,Winter 2026,IVAR-M-HO-004,IVAR000000004,Fleece Pullover Hoodie,,4499,2800,0,5,0,10,0,,,true,611020,L,Grey,Relaxed,',
            'Tops,Blouses,MONO,Women,Summer 2026,IVAR-W-BL-005,IVAR000000005,Satin Button Blouse,,3299,1900,0,5,0,0,0,,,true,620640,S,Cream,Classic,',
            'Dresses,Midi Dresses,MULTI,Women,Summer 2026,IVAR-W-DR-006,IVAR000000006,Floral Midi Dress,,5499,3200,0,5,0,15,0,,,true,620443,M,Green,A-Line,',
            'Bottoms,Trousers,MONO,Women,All Season,IVAR-W-TR-007,IVAR000000007,High Waist Trousers,,3799,2200,0,5,0,0,0,,,true,620463,28,Beige,Tapered,',
            'Tops,T-Shirts,MULTI,Kids,Summer 2026,IVAR-K-TS-008,IVAR000000008,Graphic Tee (Kids),,1299,700,0,5,0,0,0,,,true,610910,6-7Y,Red,Regular Fit,',
            'Activewear,Joggers,MONO,Men,All Season,IVAR-M-JG-009,IVAR000000009,Training Joggers,,2999,1700,0,5,0,0,0,,,true,610343,M,Charcoal,Tapered,',
            'Outerwear,Jackets,MULTI,Women,Winter 2026,IVAR-W-JK-010,IVAR000000010,Lightweight Bomber Jacket,,6999,4200,0,5,0,0,0,,,true,620193,L,Olive,Bomber,',
        ].join('\n');
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="item-upload-template.csv"');
        return res.status(HttpStatus.OK).send(template);
    }

    // ── Param routes last — static routes above must be declared first ──────

    @Get(':uploadId/status')
    @ApiOperation({ summary: 'Get upload status' })
    async getUploadStatus(@Param('uploadId') uploadId: string) {
        const status = await this.bulkUploadService.getUploadStatus(uploadId);
        return {
            status: true,
            data: status,
        };
    }

    @Delete(':uploadId')
    @ApiOperation({ summary: 'Cancel upload' })
    async cancelUpload(@Param('uploadId') uploadId: string) {
        await this.bulkUploadService.cancelUpload(uploadId);
        return {
            status: true,
            message: 'Upload cancelled successfully',
        };
    }

    // More specific sub-paths before less specific ones
    @Get(':uploadId/error-report')
    @ApiOperation({ summary: 'Download error report (streamed CSV) or check readiness via ?prepare=true' })
    async downloadErrorReport(
        @Param('uploadId') uploadId: string,
        @Res() res: any,
        @Req() req: any,
    ) {
        // ?prepare=true → JSON response to check readiness / kick off generation
        if (req.query?.prepare === 'true') {
            const result = await this.bulkUploadService.prepareErrorReport(uploadId);
            if (!result.ready) {
                await this.bulkUploadService.regenerateErrorReport(uploadId).catch(() => {});
            }
            res.header('Content-Type', 'application/json');
            res.send({ status: true, data: result });
            return;
        }

        await this.bulkUploadService.streamErrorReport(uploadId, res);
    }
}
