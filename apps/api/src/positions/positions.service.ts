import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePositionDto, UpdatePositionDto } from './positions.dto.js';

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.position.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { employees: true } },
      },
    });
  }

  async create(organizationId: string, dto: CreatePositionDto) {
    await this.assertNameFree(organizationId, dto.name);
    return this.prisma.position.create({
      data: { organizationId, name: dto.name.trim(), color: dto.color },
    });
  }

  async update(organizationId: string, id: string, dto: UpdatePositionDto) {
    await this.find(organizationId, id);
    if (dto.name) await this.assertNameFree(organizationId, dto.name, id);
    return this.prisma.position.update({
      where: { id },
      data: { name: dto.name?.trim(), color: dto.color },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.find(organizationId, id);
    const shifts = await this.prisma.shift.count({ where: { positionId: id } });
    if (shifts > 0) {
      throw new ConflictException(
        'This position is used by scheduled shifts and can’t be deleted',
      );
    }
    await this.prisma.position.delete({ where: { id } });
  }

  private async find(organizationId: string, id: string) {
    const position = await this.prisma.position.findFirst({
      where: { id, organizationId },
    });
    if (!position) throw new NotFoundException('Position not found');
    return position;
  }

  private async assertNameFree(
    organizationId: string,
    name: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.position.findFirst({
      where: {
        organizationId,
        name: { equals: name.trim(), mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
    });
    if (clash) throw new ConflictException('A position with that name exists');
  }
}
