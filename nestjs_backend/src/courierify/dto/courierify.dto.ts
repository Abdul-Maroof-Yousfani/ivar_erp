import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  booked?: boolean;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasDiscount?: boolean;

  @IsOptional()
  @IsString()
  financialStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  updatedSince?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(250)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ListShipmentsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  courier?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  updatedSince?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(250)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ShipmentActionDto {
  @IsString()
  action: string; // e.g. "cancel", "retry_delivery", "change_address", "request_return"

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  payload?: Record<string, any>;
}

export class ReceivedLineItemDto {
  @IsString()
  sku: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ReceiveReturnSingleDto {
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  shipmentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedLineItemDto)
  itemsReceived?: ReceivedLineItemDto[];
}

export class ReceiveReturnBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnSingleDto)
  returns: ReceiveReturnSingleDto[];
}

export class NetworkLookupQueryDto {
  @IsString()
  phone: string;
}

export class SettlementsQueryDto {
  @IsOptional()
  @IsString()
  courier?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(250)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  cursor?: string;
}
