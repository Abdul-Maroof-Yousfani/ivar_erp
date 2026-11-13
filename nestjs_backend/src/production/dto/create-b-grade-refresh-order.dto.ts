import { IsNotEmpty, IsString, IsArray, ValidateNested, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BGradeRefreshOrderItemDto {
  @IsNotEmpty()
  @IsString()
  itemId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  qtySent: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  bUnitValue: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  aFinalUnitCost: number;
}

export class CreateBGradeRefreshOrderDto {
  @IsNotEmpty()
  @IsString()
  supplierId: string;

  @IsNotEmpty()
  @IsString()
  bGradeWarehouseId: string;

  @IsOptional()
  @IsString()
  sentDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BGradeRefreshOrderItemDto)
  items: BGradeRefreshOrderItemDto[];
}

