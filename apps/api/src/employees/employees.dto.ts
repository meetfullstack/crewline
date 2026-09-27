import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AvailabilityKind,
  EmploymentStatus,
  EmploymentType,
} from '../generated/prisma/enums.js';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Maya' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName: string;

  @ApiProperty({ example: 'Rodriguez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName: string;

  @ApiPropertyOptional({ example: 'maya@harbourvine.test' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '416-555-0142' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @ApiPropertyOptional({ example: 17.6, description: 'Dollars per hour' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  hourlyRate?: number;

  @ApiPropertyOptional({ example: 32 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  maxWeeklyHours?: number | null;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  hireDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'First id is the primary position',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  positionIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Defaults to every location',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  locationIds?: string[];
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class ListEmployeesQuery {
  @ApiPropertyOptional({ description: 'Matches name, email or phone' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: [...Object.values(EmploymentStatus), 'ALL'] })
  @IsOptional()
  @IsIn([...Object.values(EmploymentStatus), 'ALL'])
  status?: EmploymentStatus | 'ALL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;
}

export class AvailabilityBlockDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Sunday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: 540, description: 'Minutes after local midnight' })
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute: number;

  @ApiProperty({ example: 1020 })
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute: number;

  @ApiProperty({ enum: AvailabilityKind })
  @IsEnum(AvailabilityKind)
  kind: AvailabilityKind;
}

export class ReplaceAvailabilityDto {
  @ApiProperty({ type: [AvailabilityBlockDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityBlockDto)
  blocks: AvailabilityBlockDto[];
}

export class CreateCertificationDto {
  @ApiProperty({ example: 'Smart Serve' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  issuedAt?: string;

  @ApiPropertyOptional({ example: '2030-03-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  expiresAt?: string;
}
