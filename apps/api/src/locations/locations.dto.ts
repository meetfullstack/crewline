import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'Queen Street' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: '88 Queen St E, Toronto, ON' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @ApiPropertyOptional({ example: 'America/Toronto' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 6, description: '0 = Sunday' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekStartsOn?: number;

  @ApiPropertyOptional({
    example: 9000,
    nullable: true,
    description: 'Dollars per week; null removes the budget',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  weeklyLaborBudget?: number | null;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
