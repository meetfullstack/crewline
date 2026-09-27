// Shapes returned by the Crewline API.

export type Role = "OWNER" | "MANAGER" | "EMPLOYEE";

export interface Me {
  id: string;
  email: string;
  role: Role;
  organization: { id: string; name: string; slug: string };
  employee: { id: string; firstName: string; lastName: string } | null;
}

export const isManager = (role: Role | undefined) =>
  role === "OWNER" || role === "MANAGER";
