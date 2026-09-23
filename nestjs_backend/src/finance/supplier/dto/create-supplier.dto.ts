










import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEmail,
  IsArray,
} from 'class-validator';
import { SupplierType } from '@prisma/client';

export class CreateSupplierDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: SupplierType, default: SupplierType.LOCAL })
  @IsEnum(SupplierType)
  @IsOptional()
  type?: SupplierType;

  @ApiPropertyOptional({ description: 'Nature of supplier (e.g. FABRIC, GOODS, SERVICES, ACCESSORIES)' })
  @IsString()
  @IsOptional()
  nature?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactNo?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;

  // Tax Info
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cnicNo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ntnNo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  strnNo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  srbNo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  praNo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ictNo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  chartOfAccountIds?: string[];
}
