import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class TimesheetQuery {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiPropertyOptional({ example: '2026-09-28', description: 'Any day in the week' })
  @IsOptional()
  @IsDateString({ strict: true })
  weekStart?: string;
}

/**
 * A manual entry in the location's local time. `clockOutMinute` may pass
 * 1440 for work that ran past midnight.
 */
export class ManualEntryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ example: '2026-09-28' })
  @IsDateString({ strict: true })
  date: string;

  @ApiProperty({ example: 1020 })
  @IsInt()
  @Min(0)
  @Max(1439)
  clockInMinute: number;

  @ApiProperty({ example: 1380 })
  @IsInt()
  @Min(1)
  @Max(1439 + 16 * 60)
  clockOutMinute: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  breakMinutes?: number;

  @ApiProperty({ example: 'Forgot to clock in — confirmed with the closing manager' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

export class EditEntryDto {
  @ApiProperty({ example: '2026-09-28' })
  @IsDateString({ strict: true })
  date: string;

  @ApiProperty({ example: 1020 })
  @IsInt()
  @Min(0)
  @Max(1439)
  clockInMinute: number;

  @ApiProperty({ example: 1380 })
  @IsInt()
  @Min(1)
  @Max(1439 + 16 * 60)
  clockOutMinute: number;

  @ApiPropertyOptional({ description: 'Replaces recorded breaks with one of this length' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  breakMinutes?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}
