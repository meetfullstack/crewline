import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class WeekQuery {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiPropertyOptional({
    example: '2026-09-28',
    description: 'Any day in the week; defaults to the current week',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  weekStart?: string;
}

/**
 * Shift times are sent in the location's local time: a calendar date plus
 * minutes after midnight. `endMinute` may exceed 1440 for shifts that close
 * after midnight (e.g. 1020 → 1560 is 5pm–2am).
 */
export class ShiftInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  positionId: string;

  @ApiPropertyOptional({ nullable: true, description: 'Omit or null for an open shift' })
  @IsOptional()
  @IsString()
  employeeId?: string | null;

  @ApiProperty({ example: '2026-09-28' })
  @IsDateString({ strict: true })
  date: string;

  @ApiProperty({ example: 1020 })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute: number;

  @ApiProperty({ example: 1380, description: 'Up to 16 hours after the start' })
  @IsInt()
  @Min(1)
  @Max(1439 + 16 * 60)
  endMinute: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  breakMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateShiftDto extends PartialType(ShiftInputDto) {}

export class CopyWeekDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ example: '2026-09-21' })
  @IsDateString({ strict: true })
  fromWeekStart: string;

  @ApiProperty({ example: '2026-09-28' })
  @IsDateString({ strict: true })
  toWeekStart: string;

  @ApiProperty({ enum: ['replace', 'append'] })
  @IsIn(['replace', 'append'])
  mode: 'replace' | 'append';
}

export class PublishDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ example: '2026-09-28' })
  @IsDateString({ strict: true })
  weekStart: string;
}
