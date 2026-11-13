import { Controller, Post, Get, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductionService } from './production.service';
import { CalculateCostingDto } from './dto/calculate-costing.dto';
import { CreateProductionBatchDto } from './dto/create-production-batch.dto';
import { RefreshBGradeDto } from './dto/refresh-b-grade.dto';
import { CreateBGradeRefreshOrderDto } from './dto/create-b-grade-refresh-order.dto';
import { CreateBGradeRefreshReceivingDto } from './dto/create-b-grade-refresh-receiving.dto';

@ApiTags('Production & Garment Costing')
@Controller('api/production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate live costing metrics based on fabric & CMT inputs' })
  calculateCosting(@Body() dto: CalculateCostingDto) {
    return this.productionService.calculateCosting(dto);
  }

  @Post('create')
  @ApiOperation({ summary: 'Commit production batch, stock ledger movements & auto-generate CMT invoice' })
  createBatch(@Body() dto: CreateProductionBatchDto, @Req() req: any) {
    const ctx = {
      userId: req?.user?.id || req?.user?.userId,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers ? req.headers['user-agent'] : undefined,
    };
    return this.productionService.createBatch(dto, ctx);
  }

  @Post('refresh-b-grade')
  @ApiOperation({ summary: 'Send B-grade stock for refresh and move into A-grade warehouse' })
  refreshBGrade(@Body() dto: RefreshBGradeDto, @Req() req: any) {
    const ctx = {
      userId: req?.user?.id || req?.user?.userId,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers ? req.headers['user-agent'] : undefined,
    };
    return this.productionService.refreshBGrade(dto, ctx);
  }

  @Get('batches')
  @ApiOperation({ summary: 'List all production batches with pagination and search' })
  findAllBatches(
    @Query('supplierId') supplierId?: string,
    @Query('articleItemId') articleItemId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productionService.findAllBatches({
      supplierId,
      articleItemId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get full production batch details by ID' })
  findOneBatch(@Param('id') id: string) {
    return this.productionService.findOneBatch(id);
  }

  @Get('b-grade-inventory')
  @ApiOperation({ summary: 'Get B-Grade stock by item and batch with remaining valuation' })
  getBGradeInventory() {
    return this.productionService.getBGradeInventory();
  }

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get high-level production summary KPIs' })
  getDashboardStats() {
    return this.productionService.getDashboardStats();
  }

  // ── B-Grade Refresh Workflow (Two-Phase: Send Out → Receive Back) ──

  @Post('b-grade-refresh-orders')
  @ApiOperation({ summary: 'Create a B-Grade refresh order (send stock to vendor for refresh)' })
  createBGradeRefreshOrder(@Body() dto: CreateBGradeRefreshOrderDto, @Req() req: any) {
    const ctx = {
      userId: req?.user?.id || req?.user?.userId,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers ? req.headers['user-agent'] : undefined,
    };
    return this.productionService.createBGradeRefreshOrder(dto, ctx);
  }

  @Post('b-grade-refresh-receivings')
  @ApiOperation({ summary: 'Receive refreshed stock back from vendor' })
  createBGradeRefreshReceiving(@Body() dto: CreateBGradeRefreshReceivingDto, @Req() req: any) {
    const ctx = {
      userId: req?.user?.id || req?.user?.userId,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers ? req.headers['user-agent'] : undefined,
    };
    return this.productionService.createBGradeRefreshReceiving(dto, ctx);
  }

  @Get('b-grade-refresh-orders')
  @ApiOperation({ summary: 'List all B-Grade refresh orders' })
  getBGradeRefreshOrders(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.productionService.getBGradeRefreshOrders({ status, supplierId });
  }

  @Get('b-grade-refresh-orders/:id')
  @ApiOperation({ summary: 'Get single B-Grade refresh order with full detail' })
  getBGradeRefreshOrderById(@Param('id') id: string) {
    return this.productionService.getBGradeRefreshOrderById(id);
  }

  @Patch('b-grade-refresh-orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending B-Grade refresh order and reverse stock' })
  cancelBGradeRefreshOrder(@Param('id') id: string, @Req() req: any) {
    const ctx = {
      userId: req?.user?.id || req?.user?.userId,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers ? req.headers['user-agent'] : undefined,
    };
    return this.productionService.cancelBGradeRefreshOrder(id, ctx);
  }
}

