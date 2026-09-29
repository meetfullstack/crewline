import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

class UpdateOrganizationDto {
  @ApiProperty({ example: 'Harbour & Vine' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}

const select = { id: true, name: true, slug: true, createdAt: true } as const;

@ApiTags('organization')
@ApiCookieAuth('cl_access')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select,
    });
  }

  @Roles(Role.OWNER)
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data: { name: dto.name.trim() },
      select,
    });
  }
}
