import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  EmploymentStatus,
  ScheduleStatus,
  SwapStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Conflict } from '../scheduling/conflicts.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import type { CreateSwapDto, ListSwapsQuery, ReviewSwapDto } from './swaps.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead coworkers' shifts are offered as trade options. */
const TRADE_WINDOW_DAYS = 21;

const OPEN_STATUSES = [SwapStatus.PENDING_COWORKER, SwapStatus.PENDING_MANAGER];

const swapSelect = {
  id: true,
  status: true,
  message: true,
  respondedAt: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  shiftId: true,
  targetShiftId: true,
  requester: { select: { id: true, firstName: true, lastName: true } },
  targetEmployee: { select: { id: true, firstName: true, lastName: true } },
  reviewedBy: { select: { employee: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.ShiftSwapSelect;

type SwapRow = Prisma.ShiftSwapGetPayload<{ select: typeof swapSelect }>;

@Injectable()
export class SwapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
  ) {}

  // ─── Staff ─────────────────────────────────────────────────────────────

  /**
   * Who could take this shift: active coworkers at the same location who are
   * trained for the position. For each, whether covering would conflict and
   * which of their own shifts the requester could take in a trade.
   */
  async candidates(organizationId: string, employeeId: string, shiftId: string) {
    const shift = await this.ownFutureShift(organizationId, employeeId, shiftId);
    const me = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { positions: { select: { positionId: true } } },
    });
    const myPositions = me.positions.map((p) => p.positionId);

    const coworkers = await this.prisma.employee.findMany({
      where: {
        organizationId,
        id: { not: employeeId },
        status: EmploymentStatus.ACTIVE,
        locations: { some: { locationId: shift.locationId } },
        positions: { some: { positionId: shift.positionId } },
      },
      orderBy: { firstName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        shifts: {
          where: {
            locationId: shift.locationId,
            positionId: { in: myPositions },
            schedule: { status: ScheduleStatus.PUBLISHED },
            startsAt: { gt: new Date(), lt: new Date(Date.now() + TRADE_WINDOW_DAYS * DAY_MS) },
          },
          orderBy: { startsAt: 'asc' },
          select: { id: true },
        },
      },
    });

    const tradeIds = coworkers.flatMap((c) => c.shifts.map((s) => s.id));
    const described = await this.scheduling.describeShifts(organizationId, tradeIds);

    return Promise.all(
      coworkers.map(async (c) => {
        const conflicts = await this.scheduling.assignmentConflicts(organizationId, shiftId, c.id);
        return {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          coverConflicts: conflicts,
          canCover: !hasError(conflicts),
          tradeShifts: c.shifts.map((s) => described.get(s.id)).filter((s) => s !== undefined),
        };
      }),
    );
  }

  async create(organizationId: string, employeeId: string, dto: CreateSwapDto) {
    const shift = await this.ownFutureShift(organizationId, employeeId, dto.shiftId);
    if (dto.targetEmployeeId === employeeId) {
      throw new BadRequestException('Pick a coworker');
    }
    const target = await this.prisma.employee.findFirst({
      where: {
        id: dto.targetEmployeeId,
        organizationId,
        status: EmploymentStatus.ACTIVE,
        positions: { some: { positionId: shift.positionId } },
        locations: { some: { locationId: shift.locationId } },
      },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('That coworker can’t work this shift');

    if (dto.targetShiftId) {
      await this.ownFutureShift(organizationId, dto.targetEmployeeId, dto.targetShiftId);
    }

    const open = await this.prisma.shiftSwap.findFirst({
      where: {
        status: { in: OPEN_STATUSES },
        OR: [{ shiftId: dto.shiftId }, { targetShiftId: dto.shiftId }],
      },
    });
    if (open) throw new ConflictException('This shift already has a swap in progress');

    const created = await this.prisma.shiftSwap.create({
      data: {
        requesterId: employeeId,
        shiftId: dto.shiftId,
        targetEmployeeId: dto.targetEmployeeId,
        targetShiftId: dto.targetShiftId ?? null,
        message: dto.message?.trim() || null,
      },
      select: swapSelect,
    });
    return this.present(organizationId, [created]).then((r) => r[0]);
  }

  async listMine(organizationId: string, employeeId: string) {
    const rows = await this.prisma.shiftSwap.findMany({
      where: { OR: [{ requesterId: employeeId }, { targetEmployeeId: employeeId }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: swapSelect,
    });
    return this.present(organizationId, rows);
  }

  async respond(organizationId: string, employeeId: string, id: string, accept: boolean) {
    const swap = await this.prisma.shiftSwap.findFirst({
      where: { id, targetEmployeeId: employeeId, requester: { organizationId } },
      select: { status: true, shiftId: true, targetShiftId: true },
    });
    if (!swap) throw new NotFoundException('Swap not found');
    if (swap.status !== SwapStatus.PENDING_COWORKER) {
      throw new ConflictException('This swap is no longer waiting for you');
    }
    if (accept) {
      // Don't let someone accept into a double-booking.
      const conflicts = await this.scheduling.assignmentConflicts(
        organizationId,
        swap.shiftId,
        employeeId,
        swap.targetShiftId ? [swap.targetShiftId] : [],
      );
      const blocking = conflicts.find((c) => c.severity === 'error');
      if (blocking) {
        throw new ConflictException(`You can’t take this shift: ${blocking.message}`);
      }
    }
    const updated = await this.prisma.shiftSwap.update({
      where: { id },
      data: {
        status: accept ? SwapStatus.PENDING_MANAGER : SwapStatus.DECLINED,
        respondedAt: new Date(),
      },
      select: swapSelect,
    });
    return this.present(organizationId, [updated]).then((r) => r[0]);
  }

  async cancel(employeeId: string, id: string) {
    const { count } = await this.prisma.shiftSwap.updateMany({
      where: { id, requesterId: employeeId, status: { in: OPEN_STATUSES } },
      data: { status: SwapStatus.CANCELLED },
    });
    if (count === 0) throw new ConflictException('Only swaps in progress can be cancelled');
  }

  // ─── Managers ──────────────────────────────────────────────────────────

  async listForOrganization(organizationId: string, query: ListSwapsQuery) {
    const status = query.status ?? SwapStatus.PENDING_MANAGER;
    const rows = await this.prisma.shiftSwap.findMany({
      where: {
        requester: { organizationId },
        status: status === 'ALL' ? undefined : status,
      },
      orderBy: { createdAt: status === SwapStatus.PENDING_MANAGER ? 'asc' : 'desc' },
      take: 100,
      select: swapSelect,
    });
    const presented = await this.present(organizationId, rows);
    if (status !== SwapStatus.PENDING_MANAGER) return presented;
    // Show managers exactly what approving would cause, for both people.
    return Promise.all(presented.map((s) => this.withImpact(organizationId, s)));
  }

  async review(organizationId: string, reviewerUserId: string, id: string, dto: ReviewSwapDto) {
    const swap = await this.prisma.shiftSwap.findFirst({
      where: { id, requester: { organizationId } },
      select: {
        status: true,
        shiftId: true,
        targetShiftId: true,
        requesterId: true,
        targetEmployeeId: true,
        requester: { select: { userId: true } },
        targetEmployee: { select: { userId: true } },
      },
    });
    if (!swap) throw new NotFoundException('Swap not found');
    if (swap.status !== SwapStatus.PENDING_MANAGER) {
      throw new ConflictException('This swap isn’t waiting for approval');
    }
    if ([swap.requester.userId, swap.targetEmployee.userId].includes(reviewerUserId)) {
      throw new ForbiddenException('Someone else needs to approve a swap you’re part of');
    }

    if (dto.status === SwapStatus.APPROVED) {
      const impact = await this.impact(organizationId, swap);
      const blocking = [...impact.target, ...impact.requester].find((c) => c.severity === 'error');
      if (blocking) throw new ConflictException(`Can’t approve: ${blocking.message}`);

      await this.prisma.$transaction(async (tx) => {
        // Guard against the schedule having changed since the request.
        const moved = await tx.shift.updateMany({
          where: { id: swap.shiftId, employeeId: swap.requesterId },
          data: { employeeId: swap.targetEmployeeId },
        });
        const traded = swap.targetShiftId
          ? await tx.shift.updateMany({
              where: { id: swap.targetShiftId, employeeId: swap.targetEmployeeId },
              data: { employeeId: swap.requesterId },
            })
          : { count: 1 };
        if (moved.count !== 1 || traded.count !== 1) {
          throw new ConflictException('The schedule changed since this swap was requested');
        }
        const shifts = await tx.shift.findMany({
          where: { id: { in: [swap.shiftId, swap.targetShiftId].filter((x): x is string => !!x) } },
          select: { scheduleId: true },
        });
        await tx.schedule.updateMany({
          where: { id: { in: shifts.map((s) => s.scheduleId) } },
          data: { updatedAt: new Date() },
        });
        await tx.shiftSwap.update({
          where: { id },
          data: {
            status: SwapStatus.APPROVED,
            reviewedById: reviewerUserId,
            reviewedAt: new Date(),
            reviewNote: dto.note?.trim() || null,
          },
        });
        // Any other open requests involving these shifts are now moot.
        await tx.shiftSwap.updateMany({
          where: {
            id: { not: id },
            status: { in: OPEN_STATUSES },
            OR: [
              { shiftId: { in: [swap.shiftId, swap.targetShiftId ?? ''] } },
              { targetShiftId: { in: [swap.shiftId, swap.targetShiftId ?? ''] } },
            ],
          },
          data: { status: SwapStatus.CANCELLED },
        });
      });
    } else {
      await this.prisma.shiftSwap.update({
        where: { id },
        data: {
          status: SwapStatus.DENIED,
          reviewedById: reviewerUserId,
          reviewedAt: new Date(),
          reviewNote: dto.note?.trim() || null,
        },
      });
    }

    const row = await this.prisma.shiftSwap.findUniqueOrThrow({ where: { id }, select: swapSelect });
    return this.present(organizationId, [row]).then((r) => r[0]);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async impact(
    organizationId: string,
    swap: { shiftId: string; targetShiftId: string | null; requesterId: string; targetEmployeeId: string },
  ) {
    const [target, requester] = await Promise.all([
      this.scheduling.assignmentConflicts(
        organizationId,
        swap.shiftId,
        swap.targetEmployeeId,
        swap.targetShiftId ? [swap.targetShiftId] : [],
      ),
      swap.targetShiftId
        ? this.scheduling.assignmentConflicts(organizationId, swap.targetShiftId, swap.requesterId, [
            swap.shiftId,
          ])
        : Promise.resolve([] as Conflict[]),
    ]);
    return { target, requester };
  }

  private async withImpact<T extends Awaited<ReturnType<SwapsService['present']>>[number]>(
    organizationId: string,
    swap: T,
  ) {
    const impact = await this.impact(organizationId, {
      shiftId: swap.shiftId,
      targetShiftId: swap.targetShiftId,
      requesterId: swap.requester.id,
      targetEmployeeId: swap.targetEmployee.id,
    });
    return { ...swap, impact, canApprove: !hasError([...impact.target, ...impact.requester]) };
  }

  private async present(organizationId: string, rows: SwapRow[]) {
    const ids = rows.flatMap((r) => [r.shiftId, r.targetShiftId]).filter((x): x is string => !!x);
    const shifts = await this.scheduling.describeShifts(organizationId, ids);
    return rows.map(({ reviewedBy, ...row }) => ({
      ...row,
      kind: row.targetShiftId ? ('TRADE' as const) : ('COVER' as const),
      shift: shifts.get(row.shiftId) ?? null,
      targetShift: row.targetShiftId ? (shifts.get(row.targetShiftId) ?? null) : null,
      reviewedBy: reviewedBy?.employee ?? null,
    }));
  }

  /** A published, upcoming shift that belongs to `employeeId`. */
  private async ownFutureShift(organizationId: string, employeeId: string, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        employeeId,
        location: { organizationId },
        schedule: { status: ScheduleStatus.PUBLISHED },
      },
      select: { id: true, locationId: true, positionId: true, startsAt: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.startsAt <= new Date()) {
      throw new BadRequestException('Shifts that have started can’t be swapped');
    }
    return shift;
  }
}

const hasError = (conflicts: Conflict[]) => conflicts.some((c) => c.severity === 'error');
