/**
 * Demo data: a fictional Toronto restaurant with a realistic crew.
 *
 *   npm run db:seed -w @crewline/api
 *
 * Wipes the demo organization and recreates it, so it is safe to re-run.
 * Dates are relative to the current week so the demo never looks stale:
 * this week is published, next week is a draft still being built.
 *
 * Shifts are staffed by the same rules engine the app uses — each slot goes
 * to the qualified person with the fewest hours and no conflicts — and then
 * a few deliberate problems are planted in the draft so the builder has
 * something to flag.
 *
 * Demo logins (local development only — see README):
 *   owner@harbourvine.test    / crewline-demo   (Owner)
 *   manager@harbourvine.test  / crewline-demo   (Manager)
 *   maya@harbourvine.test     / crewline-demo   (Employee)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import {
  addLocalDays,
  dateColumn,
  weekStartOf,
  zonedInstant,
} from '../src/common/time.js';
import {
  AvailabilityKind,
  EmploymentType,
  RequestStatus,
  Role,
  ScheduleStatus,
  TimeOffType,
} from '../src/generated/prisma/enums.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  type EmployeeContext,
  findConflicts,
  paidHours,
  type ShiftLike,
} from '../src/scheduling/conflicts.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_SLUG = 'harbour-vine';
const DEMO_PASSWORD = 'crewline-demo';
const TZ = 'America/Toronto';

const POSITIONS = {
  manager: { name: 'Manager', color: '#64748b' },
  server: { name: 'Server', color: '#f97316' },
  bartender: { name: 'Bartender', color: '#8b5cf6' },
  host: { name: 'Host', color: '#10b981' },
  lineCook: { name: 'Line Cook', color: '#0ea5e9' },
  prepCook: { name: 'Prep Cook', color: '#06b6d4' },
  dishwasher: { name: 'Dishwasher', color: '#a3a3a3' },
} as const;
type PositionKey = keyof typeof POSITIONS;

const h = (hours: number) => Math.round(hours * 60);

interface Staff {
  first: string;
  last: string;
  positions: PositionKey[];
  type: EmploymentType;
  rate: number; // dollars / hour
  maxHours?: number;
  login?: { email: string; role: Role };
  /** Weekday (0 = Sun) → [from, to] in hours. */
  unavailable?: Record<number, [number, number]>;
  preferred?: Record<number, [number, number]>;
  certs?: { name: string; expiresInDays: number }[];
}

const STAFF: Staff[] = [
  {
    first: 'Priya', last: 'Shah', positions: ['manager'], type: 'FULL_TIME', rate: 32, maxHours: 40,
    login: { email: 'owner@harbourvine.test', role: Role.OWNER },
    certs: [{ name: 'Food Handler', expiresInDays: 700 }],
  },
  {
    first: 'Daniel', last: 'Okafor', positions: ['manager', 'bartender'], type: 'FULL_TIME', rate: 27, maxHours: 44,
    login: { email: 'manager@harbourvine.test', role: Role.MANAGER },
    certs: [{ name: 'Smart Serve', expiresInDays: 400 }, { name: 'Food Handler', expiresInDays: 300 }],
  },
  {
    first: 'Maya', last: 'Rodriguez', positions: ['server', 'host'], type: 'PART_TIME', rate: 17.6, maxHours: 32,
    login: { email: 'maya@harbourvine.test', role: Role.EMPLOYEE },
    unavailable: { 2: [0, 16], 4: [0, 16] }, // classes Tue/Thu daytime
    certs: [{ name: 'Smart Serve', expiresInDays: 20 }],
  },
  {
    first: 'Jonah', last: 'Kim', positions: ['lineCook'], type: 'FULL_TIME', rate: 21, maxHours: 44,
    preferred: { 1: [14, 23], 2: [14, 23], 3: [14, 23] },
    certs: [{ name: 'Food Handler', expiresInDays: 500 }],
  },
  {
    first: 'Ana', last: 'Pereira', positions: ['bartender', 'server'], type: 'PART_TIME', rate: 18, maxHours: 36,
    unavailable: { 1: [0, 24] },
    certs: [{ name: 'Smart Serve', expiresInDays: 800 }],
  },
  {
    first: 'Leo', last: 'Tremblay', positions: ['host'], type: 'CASUAL', rate: 17.2, maxHours: 24,
    unavailable: { 1: [0, 17], 2: [0, 17], 3: [0, 17], 4: [0, 17], 5: [0, 17] },
  },
  {
    first: 'Sofia', last: 'Nguyen', positions: ['server'], type: 'PART_TIME', rate: 17.6, maxHours: 30,
    unavailable: { 0: [0, 24] },
    certs: [{ name: 'Smart Serve', expiresInDays: 250 }],
  },
  {
    first: 'Marcus', last: 'Bell', positions: ['lineCook', 'prepCook'], type: 'FULL_TIME', rate: 22.5, maxHours: 44,
    certs: [{ name: 'Food Handler', expiresInDays: -5 }], // expired
  },
  {
    first: 'Hana', last: 'Sato', positions: ['prepCook'], type: 'PART_TIME', rate: 19, maxHours: 30,
    preferred: { 1: [8, 15], 2: [8, 15], 3: [8, 15], 4: [8, 15], 5: [8, 15] },
    unavailable: { 6: [0, 24], 0: [0, 24] },
  },
  {
    first: 'Omar', last: 'Haddad', positions: ['dishwasher', 'prepCook'], type: 'PART_TIME', rate: 17.2, maxHours: 32,
  },
  {
    first: 'Chloé', last: 'Martin', positions: ['server', 'bartender'], type: 'PART_TIME', rate: 17.6, maxHours: 28,
    unavailable: { 3: [0, 24] },
    certs: [{ name: 'Smart Serve', expiresInDays: 600 }],
  },
  {
    first: 'Ravi', last: 'Patel', positions: ['lineCook'], type: 'PART_TIME', rate: 20, maxHours: 32,
    unavailable: { 5: [0, 24] },
  },
  {
    first: 'Grace', last: 'Liu', positions: ['host', 'server'], type: 'CASUAL', rate: 17.2, maxHours: 20,
  },
  {
    first: 'Tomás', last: 'García', positions: ['dishwasher'], type: 'CASUAL', rate: 17.2, maxHours: 28,
  },
  {
    first: 'Elena', last: 'Rossi', positions: ['server', 'bartender'], type: 'FULL_TIME', rate: 18.5, maxHours: 40,
    certs: [{ name: 'Smart Serve', expiresInDays: 900 }],
  },
  {
    first: 'Kwame', last: 'Mensah', positions: ['lineCook', 'dishwasher'], type: 'PART_TIME', rate: 19.5, maxHours: 32,
    unavailable: { 0: [0, 24] },
  },
  {
    first: 'Noah', last: 'Fischer', positions: ['bartender'], type: 'PART_TIME', rate: 18, maxHours: 30,
    unavailable: { 2: [0, 24] },
    certs: [{ name: 'Smart Serve', expiresInDays: 300 }],
  },
];

/** A slot to staff: weekday offset from Monday, position, start/end hour. */
type Slot = [day: number, position: PositionKey, from: number, to: number];

function weekTemplate(): Slot[] {
  const slots: Slot[] = [];
  for (let day = 0; day < 7; day++) {
    const busy = day >= 3; // Thursday to Sunday
    slots.push(
      [day, 'manager', 15, 23.5],
      [day, 'lineCook', 15, 23],
      [day, 'lineCook', 16.5, 24],
      [day, 'server', 16.5, 22.5],
      [day, 'bartender', 17, 25],
      [day, 'dishwasher', 17, 23.5],
    );
    if (day < 5) slots.push([day, 'prepCook', 9, 14.5]);
    if (day >= 2) slots.push([day, 'server', 11, 16]);
    if (busy) slots.push([day, 'host', 17, 22], [day, 'server', 17.5, 24]);
    if (day === 4 || day === 5) {
      slots.push([day, 'bartender', 19, 26], [day, 'lineCook', 17.5, 25]);
    }
  }
  return slots;
}

async function main() {
  await prisma.organization.deleteMany({ where: { slug: DEMO_SLUG } });

  const passwordHash = await hash(DEMO_PASSWORD);
  const org = await prisma.organization.create({
    data: {
      name: 'Harbour & Vine',
      slug: DEMO_SLUG,
      locations: {
        create: {
          name: 'King Street',
          address: '412 King St W, Toronto, ON',
          timezone: TZ,
          weekStartsOn: 1,
        },
      },
    },
    include: { locations: true },
  });
  const location = org.locations[0];

  const positionIds = {} as Record<PositionKey, string>;
  for (const [key, p] of Object.entries(POSITIONS) as [PositionKey, (typeof POSITIONS)[PositionKey]][]) {
    const created = await prisma.position.create({
      data: { organizationId: org.id, name: p.name, color: p.color },
    });
    positionIds[key] = created.id;
  }

  const thisWeek = weekStartOf(new Date(), TZ, 1);
  const nextWeek = addLocalDays(thisWeek, 7);

  // ─── Staff ───────────────────────────────────────────────────────────
  const people: { staff: Staff; ctx: EmployeeContext }[] = [];
  for (const [index, s] of STAFF.entries()) {
    const user = s.login
      ? await prisma.user.create({
          data: { organizationId: org.id, email: s.login.email, passwordHash, role: s.login.role },
        })
      : null;

    const blocks = (kind: AvailabilityKind, source?: Record<number, [number, number]>) =>
      Object.entries(source ?? {}).map(([day, [from, to]]) => ({
        dayOfWeek: Number(day),
        startMinute: h(from),
        endMinute: h(to),
        kind,
      }));
    const availability = [
      ...blocks(AvailabilityKind.UNAVAILABLE, s.unavailable),
      ...blocks(AvailabilityKind.PREFERRED, s.preferred),
    ];

    const employee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        userId: user?.id,
        firstName: s.first,
        lastName: s.last,
        email:
          s.login?.email ??
          `${s.first.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '')}@harbourvine.test`,
        phone: `416-555-${String(1000 + index * 37).slice(-4)}`,
        employmentType: s.type,
        hourlyRateCents: Math.round(s.rate * 100),
        maxWeeklyHours: s.maxHours,
        hireDate: dateColumn(addLocalDays(thisWeek, -30 * (index + 2))),
        locations: { create: { locationId: location.id } },
        positions: {
          create: s.positions.map((key, i) => ({ positionId: positionIds[key], isPrimary: i === 0 })),
        },
        availability: { create: availability },
        certifications: {
          create: (s.certs ?? []).map((c) => ({
            name: c.name,
            issuedAt: dateColumn(addLocalDays(thisWeek, c.expiresInDays - 3 * 365)),
            expiresAt: dateColumn(addLocalDays(thisWeek, c.expiresInDays)),
          })),
        },
      },
    });

    people.push({
      staff: s,
      ctx: {
        id: employee.id,
        firstName: s.first,
        status: 'ACTIVE',
        positionIds: s.positions.map((key) => positionIds[key]),
        maxWeeklyHours: s.maxHours ?? null,
        availability,
        timeOff: [],
      },
    });
  }
  const person = (first: string) => people.find((p) => p.staff.first === first)!;

  // ─── Time off (before staffing, so the engine schedules around it) ────
  const timeOff = [
    { who: 'Jonah', type: TimeOffType.SICK, from: -3, to: -3, status: RequestStatus.APPROVED },
    { who: 'Sofia', type: TimeOffType.PERSONAL, from: 11, to: 11, status: RequestStatus.PENDING, reason: 'Moving apartments' },
    { who: 'Ravi', type: TimeOffType.VACATION, from: 8, to: 9, status: RequestStatus.APPROVED, reason: 'Family visiting' },
    { who: 'Maya', type: TimeOffType.VACATION, from: 16, to: 19, status: RequestStatus.PENDING, reason: 'Cousin’s wedding in Montréal' },
  ];
  for (const t of timeOff) {
    const p = person(t.who);
    const startDate = addLocalDays(thisWeek, t.from);
    const endDate = addLocalDays(thisWeek, t.to);
    await prisma.timeOffRequest.create({
      data: {
        employeeId: p.ctx.id,
        type: t.type,
        startDate: dateColumn(startDate),
        endDate: dateColumn(endDate),
        reason: t.reason,
        status: t.status,
        reviewedAt: t.status === RequestStatus.APPROVED ? new Date() : null,
      },
    });
    p.ctx.timeOff.push({ startDate, endDate, status: t.status });
  }

  // ─── Shifts ──────────────────────────────────────────────────────────
  const booked = new Map<string, ShiftLike[]>(people.map((p) => [p.ctx.id, []]));
  const weekHours = (id: string, weekStart: string) =>
    booked
      .get(id)!
      .filter((s) => s.startsAt >= zonedInstant(weekStart, 0, TZ) && s.startsAt < zonedInstant(addLocalDays(weekStart, 7), 0, TZ))
      .reduce((sum, s) => sum + paidHours(s), 0);

  const toShift = (weekStart: string, [day, pos, from, to]: Slot): ShiftLike => {
    const date = addLocalDays(weekStart, day);
    return {
      employeeId: null,
      positionId: positionIds[pos],
      startsAt: zonedInstant(date, h(from), TZ),
      endsAt: zonedInstant(addLocalDays(date, Math.floor(to / 24)), h(to % 24), TZ),
      breakMinutes: to - from >= 6 ? 30 : 0,
    };
  };

  /** Staffs a slot with the least-booked qualified person who has no conflicts. */
  const staff = (weekStart: string, shift: ShiftLike): ShiftLike => {
    const candidates = people
      .filter((p) => p.ctx.positionIds.includes(shift.positionId))
      .sort((a, b) => weekHours(a.ctx.id, weekStart) - weekHours(b.ctx.id, weekStart));
    for (const p of candidates) {
      const trial = { ...shift, employeeId: p.ctx.id };
      const conflicts = findConflicts(trial, {
        employee: p.ctx,
        otherShifts: booked.get(p.ctx.id)!,
        timeZone: TZ,
        weekStart,
      });
      if (conflicts.length === 0) {
        booked.get(p.ctx.id)!.push(trial);
        return trial;
      }
    }
    return shift; // nobody free: leave it open
  };

  const weeks = [
    { start: thisWeek, status: ScheduleStatus.PUBLISHED },
    { start: nextWeek, status: ScheduleStatus.DRAFT },
  ];
  let total = 0;
  for (const week of weeks) {
    let shifts = weekTemplate().map((slot) => staff(week.start, toShift(week.start, slot)));

    if (week.status === ScheduleStatus.PUBLISHED) {
      // Extra weekend cover posted for staff to pick up in the portal.
      shifts.push(
        toShift(week.start, [4, 'server', 11, 16]),
        toShift(week.start, [5, 'host', 17, 22]),
        toShift(week.start, [6, 'bartender', 18, 24]),
      );
    }

    if (week.status === ScheduleStatus.DRAFT) {
      // Still being built: a couple of slots not created yet...
      shifts = shifts.filter((_, i) => i % 9 !== 4);
      // ...and a few judgement calls the builder should flag.
      const maya = person('Maya').ctx.id;
      shifts.push({ ...toShift(week.start, [1, 'server', 11, 16]), employeeId: maya }); // class until 4pm

      // Whoever closes the line late Friday also opens Saturday brunch: a "clopen".
      const friday = addLocalDays(week.start, 4);
      const closer = shifts
        .filter((s) => s.positionId === positionIds.lineCook && s.employeeId)
        .filter((s) => s.startsAt >= zonedInstant(friday, 0, TZ) && s.startsAt < zonedInstant(addLocalDays(friday, 1), 0, TZ))
        .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
      if (closer) {
        shifts.push({ ...toShift(week.start, [5, 'lineCook', 7, 12]), employeeId: closer.employeeId });
      }

      // Extra weekend cover nobody has picked up yet.
      shifts.push(
        toShift(week.start, [4, 'server', 18, 23]),
        toShift(week.start, [5, 'bartender', 20, 26]),
      );
    }

    const schedule = await prisma.schedule.create({
      data: {
        locationId: location.id,
        weekStart: dateColumn(week.start),
        status: week.status,
        publishedAt: week.status === ScheduleStatus.PUBLISHED ? new Date() : null,
      },
    });
    await prisma.shift.createMany({
      data: shifts.map((s) => ({ ...s, scheduleId: schedule.id, locationId: location.id })),
    });
    total += shifts.length;
  }

  console.log(
    `Seeded "${org.name}": ${STAFF.length} staff, ${Object.keys(POSITIONS).length} positions, ${total} shifts (weeks of ${thisWeek} and ${nextWeek}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
