import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to see your team&apos;s schedule.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          New to Crewline?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create your team
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
