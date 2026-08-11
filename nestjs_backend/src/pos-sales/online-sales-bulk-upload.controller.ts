import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    UseGuards,
    Res,
    HttpStatus,
    Req,
    Body,
    Sse,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { OnlineSalesBulkUploadService } from './online-sales-bulk-upload.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadEventsService } from '../finance/item/upload-events.service';
import { BaseBulkUploadController } from '../common/controllers/base-bulk-upload.controller';

@ApiTags('Online Sales Bulk Upload')
@Controller('api/pos-sales/online-sales/bulk-upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OnlineSalesBulkUploadController extends BaseBulkUploadController {
    constructor(
        private readonly onlineSalesBulkUploadService: OnlineSalesBulkUploadService,
        eventsService: UploadEventsService,
    ) {
        super(onlineSalesBulkUploadService, eventsService, 'Online Sales');
    }

    @Post('online-uploader')
    @ApiOperation({ summary: 'Upload online outlet sales JSON payload (Shopify format)' })
    @UseGuards(PermissionGuard('pos.sales.create'))
    async uploadOnlineJson(
        @Body() payload: any,
        @GetUser('id') userId: string,
    ) {
        return this.onlineSalesBulkUploadService.processJsonPayload(payload, userId);
    }

    @Post()
    @ApiOperation({ summary: 'Upload Online Sales sheet for validation' })
    @UseGuards(PermissionGuard('pos.sales.create'))
    async uploadFile(@Req() req: any, @GetUser('id') userId: string) {
        return super.uploadFile(req, userId);
    }

    @Post(':uploadId/confirm')
    @ApiOperation({ summary: 'Confirm and start import of valid online sales' })
    @UseGuards(PermissionGuard('pos.sales.create'))
    async confirmUpload(@Param('uploadId') uploadId: string, @GetUser('id') userId: string) {
        return super.confirmUpload(uploadId, userId);
    }

    @Sse(':uploadId/events')
    @ApiOperation({ summary: 'Stream Online Sales bulk upload events (SSE)' })
    @UseGuards(PermissionGuard('pos.sales.read'))
    streamEvents(@Param('uploadId') uploadId: string) {
        return super.streamEvents(uploadId);
    }

    @Get(':uploadId/status')
    @ApiOperation({ summary: 'Get Online Sales upload status' })
    @UseGuards(PermissionGuard('pos.sales.read'))
    async getUploadStatus(@Param('uploadId') uploadId: string) {
        return super.getUploadStatus(uploadId);
    }

    @Delete(':uploadId')
    @ApiOperation({ summary: 'Cancel Online Sales upload' })
    @UseGuards(PermissionGuard('pos.sales.delete'))
    async cancelUpload(@Param('uploadId') uploadId: string) {
        return super.cancelUpload(uploadId);
    }

    @Get('history/list')
    @ApiOperation({ summary: 'Get Online Sales upload history' })
    @UseGuards(PermissionGuard('pos.sales.read'))
    async getUploadHistory(@GetUser('id') userId: string) {
        return super.getUploadHistory(userId);
    }

    @Get(':uploadId/error-report')
    @ApiOperation({ summary: 'Download Online Sales validation error report' })
    @UseGuards(PermissionGuard('pos.sales.read'))
    async downloadErrorReport(@Param('uploadId') uploadId: string, @Res() res: any) {
        return super.downloadErrorReport(uploadId, res);
    }

    @Get(':uploadId/success-report')
    @ApiOperation({ summary: 'Download Online Sales validation success report' })
    @UseGuards(PermissionGuard('pos.sales.read'))
    async downloadSuccessReport(@Param('uploadId') uploadId: string, @Res() res: any) {
        const upload = await this.onlineSalesBulkUploadService.getUploadStatus(uploadId);
        const csv = [
            'Upload ID,Total Records,Success Records,Status',
            `${uploadId},${upload.totalRecords},${upload.successRecords},${upload.status}`,
        ].join('\n');
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="online-sales-success-${uploadId}.csv"`);
        return res.status(HttpStatus.OK).send(csv);
    }

    @Get('template/download')
    @ApiOperation({ summary: 'Download Online Sales CSV template' })
    @UseGuards(PermissionGuard('pos.sales.read'))
    async downloadTemplate(@Res() res: any) {
        const template = [
            'Order ID,Order Date,Customer Name,Phone,Email,Address,City,SKU,Barcode,Item Name,Qty,Unit Price,Discount Total,Payment Method,Payment Status,Source,Shop',
            '#1001,2026-08-11T13:29:44.416Z,John Doe,03001234567,john@example.com,"Main St 123",Islamabad,105155,105155,T Shirt,1,2350,1000,COD,paid,Shopify,Online Store',
        ].join('\n');
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="online-sales-upload-template.csv"');
        return res.status(HttpStatus.OK).send(template);
    }
}
