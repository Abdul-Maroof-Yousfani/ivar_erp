import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateFabricIssueDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @Min(0.0001)
  qtyIssued: number;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
