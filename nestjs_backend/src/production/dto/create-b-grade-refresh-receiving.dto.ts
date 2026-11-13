import { IsNotEmpty, IsString, IsArray, ValidateNested, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BGradeRefreshReceivingItemDto {
  @IsNotEmpty()
  @IsString()
  orderItemId: string;

  @IsNotEmpty()
  @IsString()
  itemId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  qtyReceived: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  qtyReturnedBGrade?: number;
}

export class CreateBGradeRefreshReceivingDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsString()
  aGradeWarehouseId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  refreshCostPerPc?: number;

  @IsOptional()
  @IsString()
  receivedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BGradeRefreshReceivingItemDto)
  items: BGradeRefreshReceivingItemDto[];
}

