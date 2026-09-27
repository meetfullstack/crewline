/**
 * Demo data: a fictional Toronto restaurant with a realistic crew.
 *
 *   npm run db:seed -w @crewline/api
 *
 * Wipes the demo organization and recreates it, so it is safe to re-run.
 * The current week is published, next week is a draft, and the dates are
 * relative to thisWeek so the demo never looks stale.
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
  Role,
  ScheduleStatus,
  TimeOffType,
} from '../src/generated/prisma/enums.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

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
  /** Weekday (0 = Sun) → [from, to] in hours; days not listed are open. */
  unavailable?: Record<number, [number, number]>;
  preferred?: Record<number, [number, number]>;
  certs?: { name: string; expiresInDays: number }[];
}

const STAFF: Staff[] = [
  {
    first: 'Priya', last: 'Shah', positions: ['manager'], type: 'FULL_TIME', rate: 32,
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
    first: 'Leo', last: 'Tremblay', positions: ['host'], type: 'CASUAL', rate: 17.2, maxHours: 20,
    unavailable: { 1: [0, 17], 2: [0, 17], 3: [0, 17], 4: [0, 17], 5: [0, 17] },
  },
  {
    first: 'Sofia', last: 'Nguyen', positions: ['server'], type: 'PART_TIME', rate: 17.6, maxHours: 30,
    unavailable: { 0: [0, 24] },
    certs: [{ name: 'Smart Serve', expiresInDays: 250 }],
  },
  {
    first: 'Marcus', last: 'Bell', positions: ['lineCook', 'prepCook'], type: 'FULL_TIME', rate: 22.5, maxHours: 44,
    certs: [{ name: 'Food Handler', expiresInDays: -5 }], // expired — shows up as a warning
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
    first: 'Grace', last: 'Liu', positions: ['host', 'server'], type: 'CASUAL', rate: 17.2, maxHours: 16,
  },
  {
    first: 'Tomás', last: 'García', positions: ['dishwasher'], type: 'CASUAL', rate: 17.2, maxHours: 24,
  },
];

/**
 * Weekly template: [weekday, position, start hour, end hour, staff index or
 * null for an open shift]. Weekdays are 0 = Mon … 6 = Sun (offset from the
 * Monday week start). Late closes run past midnight.
 */
type ShiftSpec = [number, PositionKey, number, number, number | null];

const WEEK: ShiftSpec[] = [];
for (let day = 0; day < 7; day++) {
  const weekend = day >= 4; // Fri–Sun are busier
  WEEK.push(
    [day, 'manager', 15, 23.5, day % 2 === 0 ? 0 : 1],
    [day, 'lineCook', 15, 23, day === 5 ? 11 : 3],
    [day, 'lineCook', 16, 24, day === 3 ? 11 : 7],
    [day, 'server', 16, 22.5, day === 6 ? 12 : 6],
    [day, 'bartender', 17, 25, day === 0 ? 10 : 4],
    [day, 'host', 17, 22, 5],
    [day, 'dishwasher', 17, 24, day % 3 === 0 ? 13 : 9],
  );
  if (day < 5) WEEK.push([day, 'prepCook', 9, 15, 8]);
  if (day !== 1 && day !== 3) WEEK.push([day, 'server', 11, 17, 2]);
  if (weekend) {
    WEEK.push(
      [day, 'server', 17, 24, 10],
      [day, 'bartender', 18, 26, 1],
      [day, 'lineCook', 17, 25, null], // open shift
    );
  }
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
  const employeeIds: string[] = [];
  for (const s of STAFF) {
    const user = s.login
      ? await prisma.user.create({
          data: {
            organizationId: org.id,
            email: s.login.email,
            passwordHash,
            role: s.login.role,
          },
        })
      : null;

    const availability = [
      ...Object.entries(s.unavailable ?? {}).map(([day, [from, to]]) => ({
        dayOfWeek: Number(day),
        startMinute: h(from),
        endMinute: h(to),
        kind: AvailabilityKind.UNAVAILABLE,
      })),
      ...Object.entries(s.preferred ?? {}).map(([day, [from, to]]) => ({
        dayOfWeek: Number(day),
        startMinute: h(from),
        endMinute: h(to),
        kind: AvailabilityKind.PREFERRED,
      })),
    ];

    const employee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        userId: user?.id,
        firstName: s.first,
        lastName: s.last,
        email: s.login?.email ?? `${s.first.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '')}@harbourvine.test`,
        phone: `416-555-${String(1000 + employeeIds.length * 37).slice(-4)}`,
        employmentType: s.type,
        hourlyRateCents: Math.round(s.rate * 100),
        maxWeeklyHours: s.maxHours,
        hireDate: dateColumn(addLocalDays(thisWeek, -30 * (employeeIds.length + 2))),
        locations: { create: { locationId: location.id } },
        positions: {
          create: s.positions.map((key, i) => ({
            positionId: positionIds[key],
            isPrimary: i === 0,
          })),
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
    employeeIds.push(employee.id);
  }

  // This week is published; next week is a draft with a few gaps left open.
  const weeks = [
    { start: thisWeek, status: ScheduleStatus.PUBLISHED },
    { start: addLocalDays(thisWeek, 7), status: ScheduleStatus.DRAFT },
  ];
  for (const week of weeks) {
    const schedule = await prisma.schedule.create({
      data: {
        locationId: location.id,
        weekStart: dateColumn(week.start),
        status: week.status,
        publishedAt: week.status === ScheduleStatus.PUBLISHED ? new Date() : null,
      },
    });

    const specs = week.status === ScheduleStatus.DRAFT
      ? WEEK.filter((_, i) => i % 5 !== 0) // draft week is still being built
      : WEEK;

    await prisma.shift.createMany({
      data: specs.map(([day, pos, from, to, staff]) => {
        const date = addLocalDays(week.start, day);
        return {
          scheduleId: schedule.id,
          locationId: location.id,
          positionId: positionIds[pos],
          employeeId: staff === null ? null : employeeIds[staff],
          startsAt: zonedInstant(date, h(from), TZ),
          // Hours past 24 roll into the next calendar day.
          endsAt: zonedInstant(addLocalDays(date, Math.floor(to / 24)), h(to % 24), TZ),
          breakMinutes: to - from >= 6 ? 30 : 0,
        };
      }),
    });
  }

  await prisma.timeOffRequest.createMany({
    data: [
      {
        employeeId: employeeIds[2],
        type: TimeOffType.VACATION,
        startDate: dateColumn(addLocalDays(thisWeek, 16)),
        endDate: dateColumn(addLocalDays(thisWeek, 19)),
        reason: 'Cousin’s wedding in Montréal',
      },
      {
        employeeId: employeeIds[6],
        type: TimeOffType.PERSONAL,
        startDate: dateColumn(addLocalDays(thisWeek, 11)),
        endDate: dateColumn(addLocalDays(thisWeek, 11)),
        reason: 'Moving apartments',
      },
      {
        employeeId: employeeIds[3],
        type: TimeOffType.SICK,
        startDate: dateColumn(addLocalDays(thisWeek, -3)),
        endDate: dateColumn(addLocalDays(thisWeek, -3)),
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    ],
  });

  const shiftCount = await prisma.shift.count({ where: { locationId: location.id } });
  console.log(
    `Seeded "${org.name}": ${STAFF.length} staff, ${Object.keys(POSITIONS).length} positions, ${shiftCount} shifts (weeks of ${weeks.map((w) => w.start).join(', ')}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
