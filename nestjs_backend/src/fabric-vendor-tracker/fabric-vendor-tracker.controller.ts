import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { FabricVendorTrackerService } from './fabric-vendor-tracker.service';
import { CreateFabricIssueDto } from './dto/create-fabric-issue.dto';
import { UpdateConsumptionDto } from './dto/update-consumption.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FabricStatus } from '@prisma/client';

@ApiTags('Fabric Vendor Tracker')
@Controller('api/fabric-vendor-tracker')
export class FabricVendorTrackerController {
  constructor(private readonly service: FabricVendorTrackerService) {}

  @Post()
  @ApiOperation({ summary: 'Issue fabric to a vendor' })
  create(@Body() dto: CreateFabricIssueDto, @Req() req: any) {
    return this.service.create(dto, {
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/consumption')
  @ApiOperation({ summary: 'Log consumption and returned fabric from a vendor' })
  updateConsumption(
    @Param('id') id: string,
    @Body() dto: UpdateConsumptionDto,
    @Req() req: any,
  ) {
    return this.service.updateConsumption(id, dto, {
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all fabric vendor tracking records' })
  findAll(
    @Query('supplierId') supplierId?: string,
    @Query('itemId') itemId?: string,
    @Query('status') status?: FabricStatus,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ supplierId, itemId, status, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific fabric tracker record' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a fabric tracker record and revert stock movements' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, {
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
