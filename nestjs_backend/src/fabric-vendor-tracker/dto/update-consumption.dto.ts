import {
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsString,
} from 'class-validator';

export class UpdateConsumptionDto {
  @IsNumber()
  @Min(0)
  qtyUsed: number;

  @IsNumber()
  @Min(0)
  qtyReturned: number;

  @IsNumber()
  @Min(0)
  qtyShortage: number;

  @IsDateString()
  @IsOptional()
  consumptionDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
