import { IsNotEmpty, IsString, IsNumber, IsPositive, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RefreshBGradeDto {
  @IsNotEmpty()
  @IsString()
  batchId: string; // ProductionBatch ID

  @IsOptional()
  @IsString()
  batchItemId?: string; // Optional: specific ProductionBatchItem ID for multi-article batches

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  qtyRefreshed: number; // Number of B-grade pieces refreshed and moving to A-grade

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  refreshRate?: number = 0; // Extra CMT/alteration rate per piece charged by vendor (if any)

  @IsOptional()
  @IsString()
  notes?: string;
}

