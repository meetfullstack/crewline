import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Create your team" };

export default function RegisterPage() {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-xl">Set up your restaurant</CardTitle>
        <CardDescription>
          Create a workspace for your team. You can add staff and more
          locations after.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Already on Crewline?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
