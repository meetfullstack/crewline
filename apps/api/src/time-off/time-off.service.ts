import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addLocalDays,
  dateColumn,
  type LocalDate,
  localDateOf,
} from '../common/time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { RequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateTimeOffDto,
  ListTimeOffQuery,
  ReviewTimeOffDto,
} from './time-off.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TZ = 'America/Toronto';

const requestSelect = {
  id: true,
  type: true,
  status: true,
  startDate: true,
  endDate: true,
  reason: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  reviewedBy: {
    select: { employee: { select: { firstName: true, lastName: true } } },
  },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      positions: {
        where: { isPrimary: true },
        select: { position: { select: { name: true, color: true } } },
      },
      locations: { take: 1, select: { location: { select: { timezone: true } } } },
    },
  },
} satisfies Prisma.TimeOffRequestSelect;

type RequestRow = Prisma.TimeOffRequestGetPayload<{ select: typeof requestSelect }>;

const day = (d: Date): LocalDate => d.toISOString().slice(0, 10);

@Injectable()
export class TimeOffService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Employees ─────────────────────────────────────────────────────────

  async listMine(employeeId: string) {
    const rows = await this.prisma.timeOffRequest.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
      select: requestSelect,
    });
    return Promise.all(rows.map((r) => this.present(r)));
  }

  async create(employeeId: string, dto: CreateTimeOffDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('End date must be on or after the start date');
    }
    const tz = await this.timezoneOf(employeeId);
    const today = localDateOf(new Date(), tz);
    if (dto.startDate < today) {
      throw new BadRequestException('Time off can’t start in the past');
    }
    if (dto.startDate > addLocalDays(today, 365)) {
      throw new BadRequestException('Requests can be at most a year ahead');
    }

    const overlapping = await this.prisma.timeOffRequest.findFirst({
      where: {
        employeeId,
        status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
        startDate: { lte: dateColumn(dto.endDate) },
        endDate: { gte: dateColumn(dto.startDate) },
      },
    });
    if (overlapping) {
      throw new ConflictException('You already have a request covering some of these days');
    }

    const created = await this.prisma.timeOffRequest.create({
      data: {
        employeeId,
        type: dto.type,
        startDate: dateColumn(dto.startDate),
        endDate: dateColumn(dto.endDate),
        reason: dto.reason?.trim() || null,
      },
      select: requestSelect,
    });
    return this.present(created);
  }

  async cancel(employeeId: string, id: string) {
    const { count } = await this.prisma.timeOffRequest.updateMany({
      where: { id, employeeId, status: RequestStatus.PENDING },
      data: { status: RequestStatus.CANCELLED },
    });
    if (count === 0) {
      throw new ConflictException('Only pending requests can be cancelled');
    }
  }

  // ─── Managers ──────────────────────────────────────────────────────────

  async listForOrganization(organizationId: string, query: ListTimeOffQuery) {
    const status = query.status ?? RequestStatus.PENDING;
    const rows = await this.prisma.timeOffRequest.findMany({
      where: {
        employee: { organizationId },
        status: status === 'ALL' ? undefined : status,
      },
      // Pending requests are handled soonest-first; history newest-first.
      orderBy:
        status === RequestStatus.PENDING
          ? { startDate: 'asc' }
          : { startDate: 'desc' },
      take: 200,
      select: requestSelect,
    });
    return Promise.all(rows.map((r) => this.present(r)));
  }

  async review(
    organizationId: string,
    reviewerUserId: string,
    id: string,
    dto: ReviewTimeOffDto,
  ) {
    const request = await this.prisma.timeOffRequest.findFirst({
      where: { id, employee: { organizationId } },
      select: { status: true, employee: { select: { userId: true } } },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('This request has already been handled');
    }
    if (request.employee.userId === reviewerUserId) {
      throw new ConflictException('Someone else needs to review your own request');
    }

    const updated = await this.prisma.timeOffRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.note?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: reviewerUserId,
      },
      select: requestSelect,
    });
    return this.present(updated);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async present(row: RequestRow) {
    const { employee, reviewedBy, ...request } = row;
    const tz = employee.locations[0]?.location.timezone ?? DEFAULT_TZ;
    const startDate = day(request.startDate);
    const endDate = day(request.endDate);
    return {
      ...request,
      startDate,
      endDate,
      days: Math.round((request.endDate.getTime() - request.startDate.getTime()) / DAY_MS) + 1,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        position: employee.positions[0]?.position ?? null,
      },
      reviewedBy: reviewedBy?.employee ?? null,
      // What a manager needs to fix if they approve: shifts already booked.
      scheduledShifts:
        request.status === RequestStatus.PENDING || request.status === RequestStatus.APPROVED
          ? await this.shiftsDuring(employee.id, startDate, endDate, tz)
          : 0,
    };
  }

  private async shiftsDuring(
    employeeId: string,
    startDate: LocalDate,
    endDate: LocalDate,
    tz: string,
  ) {
    const candidates = await this.prisma.shift.findMany({
      where: {
        employeeId,
        startsAt: {
          gte: new Date(dateColumn(startDate).getTime() - DAY_MS),
          lt: new Date(dateColumn(endDate).getTime() + 2 * DAY_MS),
        },
      },
      select: { startsAt: true },
    });
    return candidates.filter((s) => {
      const local = localDateOf(s.startsAt, tz);
      return local >= startDate && local <= endDate;
    }).length;
  }

  private async timezoneOf(employeeId: string) {
    const link = await this.prisma.employeeLocation.findFirst({
      where: { employeeId },
      select: { location: { select: { timezone: true } } },
    });
    return link?.location.timezone ?? DEFAULT_TZ;
  }
}
