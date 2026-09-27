import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { dateColumn } from '../common/time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { EmploymentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { availabilityProblem } from './availability.js';
import type {
  CreateCertificationDto,
  CreateEmployeeDto,
  ListEmployeesQuery,
  ReplaceAvailabilityDto,
  UpdateEmployeeDto,
} from './employees.dto.js';

/** Certifications expiring within this many days are flagged. */
const EXPIRY_WARNING_DAYS = 30;

const listSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  employmentType: true,
  hourlyRateCents: true,
  maxWeeklyHours: true,
  hireDate: true,
  user: { select: { role: true } },
  positions: {
    orderBy: { isPrimary: 'desc' },
    select: {
      isPrimary: true,
      position: { select: { id: true, name: true, color: true } },
    },
  },
  locations: { select: { location: { select: { id: true, name: true } } } },
  certifications: { select: { expiresAt: true } },
} satisfies Prisma.EmployeeSelect;

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof listSelect }>;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ListEmployeesQuery) {
    const q = query.q?.trim();
    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      // Terminated staff are hidden unless explicitly requested.
      status:
        query.status === 'ALL'
          ? undefined
          : (query.status ?? { not: EmploymentStatus.TERMINATED }),
      positions: query.positionId
        ? { some: { positionId: query.positionId } }
        : undefined,
      locations: query.locationId
        ? { some: { locationId: query.locationId } }
        : undefined,
      OR: q
        ? [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ]
        : undefined,
    };

    const rows = await this.prisma.employee.findMany({
      where,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: listSelect,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async get(organizationId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId },
      select: {
        ...listSelect,
        notes: true,
        createdAt: true,
        user: { select: { role: true, email: true, lastLoginAt: true } },
        certifications: {
          orderBy: { expiresAt: 'asc' },
          select: { id: true, name: true, issuedAt: true, expiresAt: true },
        },
        availability: {
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
          select: {
            id: true,
            dayOfWeek: true,
            startMinute: true,
            endMinute: true,
            kind: true,
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return {
      ...this.toSummary(employee),
      notes: employee.notes,
      createdAt: employee.createdAt,
      account: employee.user,
      certifications: employee.certifications,
      availability: employee.availability,
    };
  }

  async create(organizationId: string, dto: CreateEmployeeDto) {
    const positionIds = await this.validPositions(organizationId, dto.positionIds);
    const locationIds = await this.validLocations(organizationId, dto.locationIds);

    const employee = await this.prisma.employee.create({
      data: {
        organizationId,
        ...this.scalarFields(dto),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        positions: {
          create: positionIds.map((positionId, i) => ({
            positionId,
            isPrimary: i === 0,
          })),
        },
        locations: { create: locationIds.map((locationId) => ({ locationId })) },
      },
      select: { id: true },
    });
    return this.get(organizationId, employee.id);
  }

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    await this.assertExists(organizationId, id);
    const positionIds =
      dto.positionIds && (await this.validPositions(organizationId, dto.positionIds));
    const locationIds =
      dto.locationIds && (await this.validLocations(organizationId, dto.locationIds));

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...this.scalarFields(dto),
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
        },
      });
      if (positionIds) {
        await tx.employeePosition.deleteMany({ where: { employeeId: id } });
        await tx.employeePosition.createMany({
          data: positionIds.map((positionId, i) => ({
            employeeId: id,
            positionId,
            isPrimary: i === 0,
          })),
        });
      }
      if (locationIds) {
        await tx.employeeLocation.deleteMany({ where: { employeeId: id } });
        await tx.employeeLocation.createMany({
          data: locationIds.map((locationId) => ({ employeeId: id, locationId })),
        });
      }
    });
    return this.get(organizationId, id);
  }

  /**
   * Hard delete is only for mistakes. Anyone with shift history is kept for
   * payroll and reporting — managers mark them terminated instead.
   */
  async remove(organizationId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId },
      select: { userId: true, _count: { select: { shifts: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.userId) {
      throw new ConflictException(
        'This employee has a login. Mark them as terminated instead.',
      );
    }
    if (employee._count.shifts > 0) {
      throw new ConflictException(
        'This employee has shift history. Mark them as terminated instead.',
      );
    }
    await this.prisma.employee.delete({ where: { id } });
  }

  async replaceAvailability(
    organizationId: string,
    id: string,
    dto: ReplaceAvailabilityDto,
  ) {
    await this.assertExists(organizationId, id);
    const problem = availabilityProblem(dto.blocks);
    if (problem) throw new BadRequestException(problem);

    await this.prisma.$transaction([
      this.prisma.availability.deleteMany({ where: { employeeId: id } }),
      this.prisma.availability.createMany({
        data: dto.blocks.map((block) => ({ ...block, employeeId: id })),
      }),
    ]);
    return this.get(organizationId, id);
  }

  async addCertification(
    organizationId: string,
    id: string,
    dto: CreateCertificationDto,
  ) {
    await this.assertExists(organizationId, id);
    if (dto.issuedAt && dto.expiresAt && dto.expiresAt < dto.issuedAt) {
      throw new BadRequestException('Expiry date must be after the issue date');
    }
    return this.prisma.certification.create({
      data: {
        employeeId: id,
        name: dto.name.trim(),
        issuedAt: dto.issuedAt ? dateColumn(dto.issuedAt) : null,
        expiresAt: dto.expiresAt ? dateColumn(dto.expiresAt) : null,
      },
      select: { id: true, name: true, issuedAt: true, expiresAt: true },
    });
  }

  async removeCertification(
    organizationId: string,
    employeeId: string,
    certificationId: string,
  ) {
    const { count } = await this.prisma.certification.deleteMany({
      where: {
        id: certificationId,
        employeeId,
        employee: { organizationId },
      },
    });
    if (count === 0) throw new NotFoundException('Certification not found');
  }

  private toSummary(row: EmployeeRow) {
    const now = Date.now();
    const soon = now + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
    const expiries = row.certifications
      .map((c) => c.expiresAt?.getTime())
      .filter((t): t is number => t !== undefined);

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      status: row.status,
      employmentType: row.employmentType,
      hourlyRate: row.hourlyRateCents / 100,
      maxWeeklyHours: row.maxWeeklyHours,
      hireDate: row.hireDate,
      role: row.user?.role ?? null,
      positions: row.positions.map((p) => ({
        ...p.position,
        isPrimary: p.isPrimary,
      })),
      locations: row.locations.map((l) => l.location),
      certificationAlerts: {
        expired: expiries.filter((t) => t < now).length,
        expiringSoon: expiries.filter((t) => t >= now && t <= soon).length,
      },
    };
  }

  private scalarFields(dto: UpdateEmployeeDto) {
    return {
      email: dto.email?.trim().toLowerCase(),
      phone: dto.phone?.trim(),
      employmentType: dto.employmentType,
      status: dto.status,
      hourlyRateCents:
        dto.hourlyRate === undefined ? undefined : Math.round(dto.hourlyRate * 100),
      maxWeeklyHours: dto.maxWeeklyHours,
      hireDate:
        dto.hireDate === undefined
          ? undefined
          : dto.hireDate === null
            ? null
            : dateColumn(dto.hireDate),
      notes: dto.notes,
    };
  }

  private async assertExists(organizationId: string, id: string) {
    const found = await this.prisma.employee.count({
      where: { id, organizationId },
    });
    if (!found) throw new NotFoundException('Employee not found');
  }

  /** Dedupes ids and confirms every position belongs to this organization. */
  private async validPositions(organizationId: string, ids: string[] = []) {
    const unique = [...new Set(ids)];
    const found = await this.prisma.position.count({
      where: { organizationId, id: { in: unique } },
    });
    if (found !== unique.length) throw new BadRequestException('Unknown position');
    return unique;
  }

  /** As above for locations; an empty list means every location. */
  private async validLocations(organizationId: string, ids?: string[]) {
    if (!ids || ids.length === 0) {
      const all = await this.prisma.location.findMany({
        where: { organizationId },
        select: { id: true },
      });
      return all.map((l) => l.id);
    }
    const unique = [...new Set(ids)];
    const found = await this.prisma.location.count({
      where: { organizationId, id: { in: unique } },
    });
    if (found !== unique.length) throw new BadRequestException('Unknown location');
    return unique;
  }
}
