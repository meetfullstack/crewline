import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Signs up a new business: creates the organization, its first location and the owner. */
export class RegisterDto {
  @ApiProperty({ example: 'Harbour & Vine Group' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName: string;

  @ApiProperty({ example: 'Harbour & Vine — King St' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  locationName: string;

  @ApiProperty({ example: 'Priya' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName: string;

  @ApiProperty({ example: 'Shah' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName: string;

  @ApiProperty({ example: 'priya@harbourvine.test' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'America/Toronto', required: false })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
