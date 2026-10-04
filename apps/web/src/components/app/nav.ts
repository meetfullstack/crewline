import {
  ChartColumn,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Clock3,
  Timer,
  LayoutDashboard,
  Plane,
  Repeat,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: CalendarRange },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/timesheets", label: "Timesheets", icon: Timer },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/time-off", label: "Time off", icon: Plane },
  { href: "/swaps", label: "Swaps", icon: Repeat },
  { href: "/settings", label: "Settings", icon: Settings },
];

const EMPLOYEE_NAV: NavItem[] = [
  { href: "/dashboard", label: "My week", icon: LayoutDashboard },
  { href: "/me/shifts", label: "My shifts", icon: CalendarDays },
  { href: "/me/open-shifts", label: "Open shifts", icon: CalendarPlus },
  { href: "/swaps", label: "Swaps", icon: Repeat },
  { href: "/me/availability", label: "Availability", icon: Clock3 },
  { href: "/time-off", label: "Time off", icon: Plane },
];

export const navFor = (role: Role | undefined) =>
  role === "EMPLOYEE" ? EMPLOYEE_NAV : MANAGER_NAV;
