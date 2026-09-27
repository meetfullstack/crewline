"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api";
import { FormField } from "./form-field";

const schema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name").max(120),
  locationName: z.string().trim().min(1, "Name your first location").max(120),
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Keep it under 128 characters"),
});

type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api("/auth/register", {
        method: "POST",
        noRefresh: true,
        body: {
          ...values,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 409
          ? "An account with this email already exists. Try signing in."
          : error instanceof ApiError && error.status === 400
            ? error.message
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
        id="businessName"
        label="Business name"
        placeholder="Harbour & Vine Group"
        autoComplete="organization"
        error={errors.businessName}
        {...register("businessName")}
      />
      <FormField
        id="locationName"
        label="First location"
        placeholder="King Street"
        error={errors.locationName}
        {...register("locationName")}
      />
      <Separator className="my-1" />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="First name"
          autoComplete="given-name"
          error={errors.firstName}
          {...register("firstName")}
        />
        <FormField
          id="lastName"
          label="Last name"
          autoComplete="family-name"
          error={errors.lastName}
          {...register("lastName")}
        />
      </div>
      <FormField
        id="email"
        label="Work email"
        type="email"
        autoComplete="email"
        error={errors.email}
        {...register("email")}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password}
        {...register("password")}
      />
      <Button type="submit" className="h-10" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Create workspace
      </Button>
    </form>
  );
}
