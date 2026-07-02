import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class BypassedTransferRequestItemDto {
  @ApiProperty({ example: 'a6102543-15ac-4a6a-abae-8777990dec72', description: 'Item ID' })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ example: 1, description: 'Quantity' })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ example: '', description: 'Notes for specific item' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateBypassedTransferRequestDto {
  @ApiPropertyOptional({ example: '067452c4-00b5-4e2e-b5e5-b6d4fcf1f910', description: 'Source Warehouse ID' })
  @IsString()
  @IsOptional()
  fromWarehouseId?: string;

  @ApiPropertyOptional({ example: '', description: 'Source Location ID' })
  @IsString()
  @IsOptional()
  fromLocationId?: string;

  @ApiPropertyOptional({ example: '229c1ecd-11f0-43dd-94f6-17c165a3003d', description: 'Destination Location ID' })
  @IsString()
  @IsOptional()
  toLocationId?: string;

  @ApiPropertyOptional({
    example: 'WAREHOUSE_TO_OUTLET',
    enum: ['WAREHOUSE_TO_OUTLET', 'OUTLET_TO_WAREHOUSE', 'OUTLET_TO_OUTLET'],
    description: 'Type of transfer'
  })
  @IsString()
  @IsOptional()
  transferType?: 'WAREHOUSE_TO_OUTLET' | 'OUTLET_TO_WAREHOUSE' | 'OUTLET_TO_OUTLET';

  @ApiProperty({ type: [BypassedTransferRequestItemDto], description: 'Items to transfer' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BypassedTransferRequestItemDto)
  items: BypassedTransferRequestItemDto[];

  @ApiPropertyOptional({ example: 'S11', description: 'General notes for transfer request' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: '', description: 'Optional ID of creator' })
  @IsString()
  @IsOptional()
  createdById?: string;
}
