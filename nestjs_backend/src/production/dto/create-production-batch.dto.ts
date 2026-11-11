import { IsNotEmpty, IsString, IsNumber, IsPositive, Min, IsOptional, IsBoolean, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductionBatchItemInputDto } from './calculate-costing.dto';

export class CreateProductionBatchDto {
  @IsNotEmpty()
  @IsString()
  supplierId: string; // CMT Vendor (Supplier) ID

  @IsNotEmpty()
  @IsString()
  fabricItemId: string; // Raw Fabric Item ID

  @IsNotEmpty()
  @IsString()
  fabricWarehouseId: string; // Warehouse where fabric was held / issued to vendor

  @IsOptional()
  @IsString()
  trackerId?: string; // Optional Fabric Vendor Tracker ID (Job Order)

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  qtyFabricUsed: number; // meters used (e.g. 2,700)

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  fabricRate: number; // rate per meter (e.g. 875)

  // Single-article mode (or primary article fallback)
  @IsOptional()
  @IsString()
  articleItemId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  qtyTotalReceived?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  qtyBGrade?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cmtRate?: number;

  // Multi-article / Dynamic Size Matrix mode
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionBatchItemInputDto)
  items?: ProductionBatchItemInputDto[];

  @IsOptional()
  @IsBoolean()
  deductBGradeCmt?: boolean = false;

  @IsNotEmpty()
  @IsString()
  aGradeWarehouseId: string; // Warehouse for sound/A-grade articles

  @IsNotEmpty()
  @IsString()
  bGradeWarehouseId: string; // Dedicated B-grade warehouse

  @IsOptional()
  @IsDateString()
  productionDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  autoApproveInvoice?: boolean = false;
}
