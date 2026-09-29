import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RequestStatus, TimeOffType } from '../generated/prisma/enums.js';

export class CreateTimeOffDto {
  @ApiProperty({ enum: TimeOffType })
  @IsEnum(TimeOffType)
  type: TimeOffType;

  @ApiProperty({ example: '2026-10-14' })
  @IsDateString({ strict: true })
  startDate: string;

  @ApiProperty({ example: '2026-10-16' })
  @IsDateString({ strict: true })
  endDate: string;

  @ApiPropertyOptional({ example: 'Family wedding' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReviewTimeOffDto {
  @ApiProperty({ enum: ['APPROVED', 'DENIED'] })
  @IsIn([RequestStatus.APPROVED, RequestStatus.DENIED])
  status: 'APPROVED' | 'DENIED';

  @ApiPropertyOptional({ example: 'Enjoy the trip!' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListTimeOffQuery {
  @ApiPropertyOptional({ enum: [...Object.values(RequestStatus), 'ALL'] })
  @IsOptional()
  @IsIn([...Object.values(RequestStatus), 'ALL'])
  status?: RequestStatus | 'ALL';
}
