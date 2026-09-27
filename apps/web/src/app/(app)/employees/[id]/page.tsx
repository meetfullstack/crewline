import type { Metadata } from "next";
import { EmployeeProfile } from "@/components/employees/employee-profile";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeePage(props: PageProps<"/employees/[id]">) {
  const { id } = await props.params;
  return <EmployeeProfile id={id} />;
}
