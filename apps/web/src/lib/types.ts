// Shapes returned by the Crewline API.

export type Role = "OWNER" | "MANAGER" | "EMPLOYEE";
export type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CASUAL";
export type AvailabilityKind = "AVAILABLE" | "PREFERRED" | "UNAVAILABLE";

export interface Me {
  id: string;
  email: string;
  role: Role;
  organization: { id: string; name: string; slug: string };
  employee: { id: string; firstName: string; lastName: string } | null;
}

export const isManager = (role: Role | undefined) =>
  role === "OWNER" || role === "MANAGER";

export interface Position {
  id: string;
  name: string;
  color: string;
  _count?: { employees: number };
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  weekStartsOn: number;
  weeklyLaborBudget: number | null;
  staffCount: number;
  /** Time zone and week start are fixed once schedules exist. */
  scheduleLocked: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: EmploymentStatus;
  employmentType: EmploymentType;
  hourlyRate: number;
  maxWeeklyHours: number | null;
  hireDate: string | null;
  role: Role | null;
  positions: (Pick<Position, "id" | "name" | "color"> & {
    isPrimary: boolean;
  })[];
  locations: { id: string; name: string }[];
  certificationAlerts: { expired: number; expiringSoon: number };
}

export interface Certification {
  id: string;
  name: string;
  issuedAt: string | null;
  expiresAt: string | null;
}

export interface AvailabilityBlock {
  id?: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  kind: AvailabilityKind;
}

export interface EmployeeDetail extends EmployeeSummary {
  notes: string | null;
  createdAt: string;
  account: { role: Role; email: string; lastLoginAt: string | null } | null;
  certifications: Certification[];
  availability: AvailabilityBlock[];
}

export type RequestStatus = "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";
export type TimeOffType = "VACATION" | "SICK" | "PERSONAL" | "UNPAID";

export interface TimeOffRequest {
  id: string;
  type: TimeOffType;
  status: RequestStatus;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    position: { name: string; color: string } | null;
  };
  reviewedBy: { firstName: string; lastName: string } | null;
  /** Shifts already booked during the request (pending or approved only). */
  scheduledShifts: number;
}

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  hourlyRate: number;
  maxWeeklyHours: number | null;
  hireDate: string | null;
  notes: string | null;
  positionIds: string[];
}
