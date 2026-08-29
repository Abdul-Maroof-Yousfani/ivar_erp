import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CourierifyService } from './courierify.service';
import {
  ListOrdersQueryDto,
  ListShipmentsQueryDto,
  ShipmentActionDto,
  ReceiveReturnBatchDto,
  ReceiveReturnSingleDto,
  NetworkLookupQueryDto,
  SettlementsQueryDto,
} from './dto/courierify.dto';

@ApiTags('Courierify Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courierify')
export class CourierifyController {
  constructor(private readonly courierifyService: CourierifyService) {}

  @Get('verify')
  @ApiOperation({ summary: 'Verify Courierify API key and shop status' })
  async verify() {
    return this.courierifyService.verifyConnection();
  }

  @Get('orders')
  @ApiOperation({ summary: 'List Courierify orders' })
  async getOrders(@Query() query: ListOrdersQueryDto) {
    return this.courierifyService.getOrders(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get single Courierify order' })
  async getOrder(@Param('id') id: string) {
    return this.courierifyService.getOrder(id);
  }

  @Get('discounts')
  @ApiOperation({ summary: 'Get discount code usage & performance' })
  async getDiscounts() {
    return this.courierifyService.getDiscounts();
  }

  @Get('shipments')
  @ApiOperation({ summary: 'List Courierify shipments' })
  async getShipments(@Query() query: ListShipmentsQueryDto) {
    return this.courierifyService.getShipments(query);
  }

  @Get('shipments/:id')
  @ApiOperation({ summary: 'Get single Courierify shipment details' })
  async getShipment(@Param('id') id: string) {
    return this.courierifyService.getShipment(id);
  }

  @Post('shipments/:id/actions')
  @ApiOperation({ summary: 'Act on a shipment (retry delivery, cancel, re-route)' })
  async actOnShipment(
    @Param('id') id: string,
    @Body() dto: ShipmentActionDto,
  ) {
    return this.courierifyService.actOnShipment(id, dto);
  }

  @Get('returns')
  @ApiOperation({ summary: 'List returned parcels' })
  async getReturns(@Query() query: ListShipmentsQueryDto) {
    return this.courierifyService.getReturns(query);
  }

  @Post('returns/receive')
  @ApiOperation({ summary: 'Receive returned parcels in warehouse' })
  async receiveReturns(
    @Body() dto: ReceiveReturnBatchDto | ReceiveReturnSingleDto,
  ) {
    return this.courierifyService.receiveReturns(dto);
  }

  @Get('settlements')
  @ApiOperation({ summary: 'List courier payouts (Financify)' })
  async getSettlements(@Query() query: SettlementsQueryDto) {
    return this.courierifyService.getSettlements(query);
  }

  @Get('settlements/:id')
  @ApiOperation({ summary: 'Get single courier payout detail' })
  async getSettlement(@Param('id') id: string) {
    return this.courierifyService.getSettlement(id);
  }

  @Get('receivables')
  @ApiOperation({ summary: 'Get outstanding COD receivables' })
  async getReceivables() {
    return this.courierifyService.getReceivables();
  }

  @Get('inventory/returns')
  @ApiOperation({ summary: 'Received returns by line item (Inventrify)' })
  async getInventrifyReturns(@Query() query: ListOrdersQueryDto) {
    return this.courierifyService.getInventrifyReturns(query);
  }

  @Get('inventory/return-rates')
  @ApiOperation({ summary: 'Return rate per SKU (Inventrify)' })
  async getReturnRates() {
    return this.courierifyService.getReturnRates();
  }

  @Get('inventory/status-summary')
  @ApiOperation({ summary: 'Units by delivery status per SKU' })
  async getStatusSummary() {
    return this.courierifyService.getStatusSummary();
  }

  @Get('network/lookup')
  @ApiOperation({ summary: 'Cross-merchant COD risk lookup for phone number' })
  async lookupCustomerNetwork(@Query() query: NetworkLookupQueryDto) {
    return this.courierifyService.lookupCustomerNetwork(query.phone);
  }

  @Get('analytics/delivery')
  @ApiOperation({ summary: 'Aggregated delivery performance metrics' })
  async getDeliveryAnalytics() {
    return this.courierifyService.getDeliveryAnalytics();
  }
}
