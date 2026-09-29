import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLocationDto, UpdateLocationDto } from './locations.dto.js';

const select = {
  id: true,
  name: true,
  address: true,
  timezone: true,
  weekStartsOn: true,
  weeklyLaborBudgetCents: true,
  _count: { select: { employees: true, schedules: true } },
} as const;

type Row = {
  weeklyLaborBudgetCents: number | null;
  _count: { employees: number; schedules: number };
} & Record<string, unknown>;

const present = ({ weeklyLaborBudgetCents, _count, ...location }: Row) => ({
  ...location,
  weeklyLaborBudget:
    weeklyLaborBudgetCents === null ? null : weeklyLaborBudgetCents / 100,
  staffCount: _count.employees,
  // Time zone and week start can't change once schedules exist: every saved
  // week and shift is anchored to them.
  scheduleLocked: _count.schedules > 0,
});

const toCents = (dollars: number | null | undefined) =>
  dollars === undefined ? undefined : dollars === null ? null : Math.round(dollars * 100);

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const rows = await this.prisma.location.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select,
    });
    return rows.map(present);
  }

  async create(organizationId: string, dto: CreateLocationDto) {
    const row = await this.prisma.location.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        timezone: dto.timezone,
        weekStartsOn: dto.weekStartsOn,
        weeklyLaborBudgetCents: toCents(dto.weeklyLaborBudget),
      },
      select,
    });
    return present(row);
  }

  async update(organizationId: string, id: string, dto: UpdateLocationDto) {
    const existing = await this.prisma.location.findFirst({
      where: { id, organizationId },
      select: { timezone: true, weekStartsOn: true, _count: { select: { schedules: true } } },
    });
    if (!existing) throw new NotFoundException('Location not found');

    const movesAnchors =
      (dto.timezone !== undefined && dto.timezone !== existing.timezone) ||
      (dto.weekStartsOn !== undefined && dto.weekStartsOn !== existing.weekStartsOn);
    if (movesAnchors && existing._count.schedules > 0) {
      throw new ConflictException(
        'Time zone and week start can’t change after schedules have been created for this location',
      );
    }

    const row = await this.prisma.location.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        address: dto.address === undefined ? undefined : dto.address?.trim() || null,
        timezone: dto.timezone,
        weekStartsOn: dto.weekStartsOn,
        weeklyLaborBudgetCents: toCents(dto.weeklyLaborBudget),
      },
      select,
    });
    return present(row);
  }
}
