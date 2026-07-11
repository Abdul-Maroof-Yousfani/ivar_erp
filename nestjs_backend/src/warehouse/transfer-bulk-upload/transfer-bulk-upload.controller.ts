import { Controller, Post, Get, Delete, Param, UseGuards, Res, HttpStatus, BadRequestException, Req, Sse, MessageEvent } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TransferBulkUploadService } from './transfer-bulk-upload.service';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { Observable } from 'rxjs';

@ApiTags('Stock Transfer Bulk Upload')
@Controller('api/warehouse/stock-transfer/bulk-upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransferBulkUploadController {
    constructor(
        private bulkUploadService: TransferBulkUploadService,
        private eventsService: UploadEventsService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Upload transfer CSV/Excel file for validation' })
    async uploadFile(@Req() req: any, @GetUser('id') userId: string) {
        const file = await req.file();
        if (!file) throw new BadRequestException('No file uploaded');

        const ext = file.filename.split('.').pop()?.toLowerCase();
        if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) throw new BadRequestException('Invalid file type. Allowed: csv, xlsx, xls');

        const buffer = await file.toBuffer();
        if (buffer.length > 50 * 1024 * 1024) throw new BadRequestException('File size exceeds 50MB limit');

        const result = await this.bulkUploadService.initiateValidation(buffer, file.filename, userId);
        return { status: true, message: 'Transfer validation initiated', data: result };
    }

    @Post(':uploadId/confirm')
    @ApiOperation({ summary: 'Confirm and start transfer import' })
    async confirmUpload(@Param('uploadId') uploadId: string, @GetUser('id') userId: string) {
        const result = await this.bulkUploadService.confirmUpload(uploadId, userId);
        return { status: true, message: 'Transfer import confirmed and started', data: result };
    }

    @Sse(':uploadId/events')
    @ApiOperation({ summary: 'Stream transfer bulk upload events (SSE)' })
    streamEvents(@Param('uploadId') uploadId: string): Observable<MessageEvent> {
        return this.eventsService.subscribe(uploadId);
    }

    @Get(':uploadId/status')
    @ApiOperation({ summary: 'Get transfer upload status' })
    async getUploadStatus(@Param('uploadId') uploadId: string) {
        return { status: true, data: await this.bulkUploadService.getUploadStatus(uploadId) };
    }

    @Delete(':uploadId')
    @ApiOperation({ summary: 'Cancel transfer upload' })
    async cancelUpload(@Param('uploadId') uploadId: string) {
        await this.bulkUploadService.cancelUpload(uploadId);
        return { status: true, message: 'Transfer upload cancelled' };
    }

    @Get(':uploadId/error-report')
    @ApiOperation({ summary: 'Download transfer error report CSV' })
    async downloadErrorReport(@Param('uploadId') uploadId: string, @Res() res: any) {
        const upload = await this.bulkUploadService.getUploadStatus(uploadId);
        const csv = this.bulkUploadService.generateErrorReport(upload.errors as any[]);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="transfer-upload-errors-${uploadId}.csv"`);
        return res.status(HttpStatus.OK).send(csv);
    }

    @Get('template/download')
    @ApiOperation({ summary: 'Download transfer CSV template' })
    async downloadTemplate(@Res() res: any) {
        const template = [
            'Barcode,SKU,Quantity',
            '889362319896,ITEM-SKU-01,10',
            ',ITEM-SKU-02,5',
            '198634299720,,12',
        ].join('\n');
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="transfer-upload-template.csv"');
        return res.status(HttpStatus.OK).send(template);
    }

    @Get(':uploadId/resolved')
    @ApiOperation({ summary: 'Get resolved stock transfer items' })
    async getResolvedItems(
        @Param('uploadId') uploadId: string,
        @Req() req: any
    ) {
        const { warehouseId, locationId } = (req.query || {}) as any;
        const data = await this.bulkUploadService.resolveItems(uploadId, warehouseId, locationId);
        return { status: true, data };
    }
}
