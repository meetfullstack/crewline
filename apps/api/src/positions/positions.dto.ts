import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsHexColor, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePositionDto {
  @ApiProperty({ example: 'Sommelier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: '#f97316' })
  @IsHexColor()
  color: string;
}

export class UpdatePositionDto extends PartialType(CreatePositionDto) {}
