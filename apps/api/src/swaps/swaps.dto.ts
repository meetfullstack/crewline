import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SwapStatus } from '../generated/prisma/enums.js';

export class CreateSwapDto {
  @ApiProperty({ description: 'Your shift to give up' })
  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @ApiProperty({ description: 'The coworker you are asking' })
  @IsString()
  @IsNotEmpty()
  targetEmployeeId: string;

  @ApiPropertyOptional({ description: 'Their shift you take in return (trade)' })
  @IsOptional()
  @IsString()
  targetShiftId?: string;

  @ApiPropertyOptional({ example: 'Can you cover? I have a family dinner.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

export class RespondSwapDto {
  @ApiProperty()
  @IsBoolean()
  accept: boolean;
}

export class ReviewSwapDto {
  @ApiProperty({ enum: ['APPROVED', 'DENIED'] })
  @IsIn([SwapStatus.APPROVED, SwapStatus.DENIED])
  status: 'APPROVED' | 'DENIED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class ListSwapsQuery {
  @ApiPropertyOptional({ enum: [...Object.values(SwapStatus), 'ALL'] })
  @IsOptional()
  @IsIn([...Object.values(SwapStatus), 'ALL'])
  status?: SwapStatus | 'ALL';
}
