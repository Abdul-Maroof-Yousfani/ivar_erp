import { IsNotEmpty, IsNumber, IsPositive, Min, IsOptional, IsBoolean, ValidateNested, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductionBatchItemInputDto {
  @IsNotEmpty()
  @IsString()
  articleItemId: string;

  @IsOptional()
  @IsString()
  sizeName?: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  qtyTotalReceived: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  qtyBGrade?: number = 0;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cmtRate: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  qtyFabricUsed?: number;
}

export class CalculateCostingDto {
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  qtyFabricUsed: number; // in meters (e.g. 2,700)

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  fabricRate: number; // rate per meter (e.g. 875)

  // Single-item mode (backward compatible)
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

  // Multi-item / Dynamic Size Matrix mode
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionBatchItemInputDto)
  items?: ProductionBatchItemInputDto[];

  @IsOptional()
  @IsBoolean()
  deductBGradeCmt?: boolean = false;
}
