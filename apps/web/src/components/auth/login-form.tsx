"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { safeNextPath } from "@/lib/safe-next";
import { FormField } from "./form-field";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api("/auth/login", { method: "POST", body: values, noRefresh: true });
      router.replace(next);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 401
          ? "That email and password don't match."
          : "Something went wrong. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email}
        {...register("email")}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
        {...register("password")}
      />
      <Button type="submit" className="h-10" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
