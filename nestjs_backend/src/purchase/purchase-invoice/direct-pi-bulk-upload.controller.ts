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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DirectPiBulkUploadService } from './direct-pi-bulk-upload.service';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { Observable } from 'rxjs';

@ApiTags('Purchase Invoice Direct Bulk Upload')
@Controller('api/purchase-invoice/bulk-upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DirectPiBulkUploadController {
    constructor(
        private readonly bulkUploadService: DirectPiBulkUploadService,
        private readonly eventsService: UploadEventsService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Upload Direct PI CSV/Excel file for validation' })
    async uploadFile(@Req() req: any, @GetUser('id') userId: string) {
        const file = await req.file();
        if (!file) throw new BadRequestException('No file uploaded');

        const ext = file.filename.split('.').pop()?.toLowerCase();
        if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
            throw new BadRequestException('Invalid file type. Allowed: csv, xlsx, xls');
        }

        const buffer = await file.toBuffer();
        if (buffer.length > 50 * 1024 * 1024) {
            throw new BadRequestException('File size exceeds 50MB limit');
        }

        const { vendorId, warehouseId, invoiceDate, notes, purchaseType } = (req.query || {}) as any;
        const result = await this.bulkUploadService.initiateValidation(
            buffer,
            file.filename,
            userId,
            { vendorId, warehouseId, invoiceDate, notes, purchaseType },
        );

        return {
            status: true,
            message: 'Direct PI validation initiated',
            data: result,
        };
    }

    @Post(':uploadId/confirm')
    @ApiOperation({ summary: 'Confirm and start Direct PI import' })
    async confirmUpload(
        @Param('uploadId') uploadId: string,
        @GetUser('id') userId: string,
        @Req() req: any,
    ) {
        const { vendorId, warehouseId, invoiceDate, notes, purchaseType } = (req.query || {}) as any;
        const result = await this.bulkUploadService.confirmUpload(
            uploadId,
            userId,
            { vendorId, warehouseId, invoiceDate, notes, purchaseType },
        );

        return {
            status: true,
            message: 'Direct PI import confirmed and started',
            data: result,
        };
    }

    @Sse(':uploadId/events')
    @ApiOperation({ summary: 'Stream Direct PI bulk upload events (SSE)' })
    streamEvents(@Param('uploadId') uploadId: string): Observable<MessageEvent> {
        return this.eventsService.subscribe(uploadId);
    }

    @Get('template/download')
    @ApiOperation({ summary: 'Download Direct PI CSV template' })
    async downloadTemplate(@Res() res: any) {
        const template = [
            'Invoice Number,Invoice Date,Due Date,Supplier,Warehouse,Purchase Type,BarCode,SKU,Quantity,Unit Cost,Tax Rate,Discount Rate,Description,Notes',
            'PI-001,2026-09-01,,SUPPLIER-001,Main Warehouse,T-SHIRT PURCHASED,889362319896,SKU-001,10,1200,0,0,Sample Direct Item 1 (PI #1),Invoice 1 item',
            'PI-001,2026-09-01,,SUPPLIER-001,Main Warehouse,T-SHIRT PURCHASED,198634299720,SKU-002,25,850,0,0,Sample Direct Item 2 (PI #1),Invoice 1 item',
            'PI-002,2026-09-01,,SUPPLIER-002,Main Warehouse,FABRIC PURCHASED,889362319896,SKU-001,50,450,0,0,Sample Direct Item 3 (PI #2),Invoice 2 item',
            ',2026-09-02,,SUPPLIER-001,Main Warehouse,CMT PURCHASED,198634299720,SKU-002,15,300,0,0,Auto-Generated PI #3,Auto sequence PI',
        ].join('\n');

        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="direct-purchase-invoice-template.csv"');
        return res.status(HttpStatus.OK).send(template);
    }

    @Get(':uploadId/status')
    @ApiOperation({ summary: 'Get Direct PI upload status' })
    async getUploadStatus(@Param('uploadId') uploadId: string) {
        const status = await this.bulkUploadService.getUploadStatus(uploadId);
        return { status: true, data: status };
    }

    @Delete(':uploadId')
    @ApiOperation({ summary: 'Cancel Direct PI upload' })
    async cancelUpload(@Param('uploadId') uploadId: string) {
        await this.bulkUploadService.cancelUpload(uploadId);
        return { status: true, message: 'Direct PI upload cancelled' };
    }

    @Get(':uploadId/error-report')
    @ApiOperation({ summary: 'Download Direct PI error report CSV' })
    async downloadErrorReport(@Param('uploadId') uploadId: string, @Res() res: any) {
        const upload = await this.bulkUploadService.getUploadStatus(uploadId);
        const csv = this.bulkUploadService.generateErrorReport(upload.errors as any[]);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="direct-pi-errors-${uploadId}.csv"`);
        return res.status(HttpStatus.OK).send(csv);
    }
}
