"use client";

import { AvailabilityEditor } from "@/components/employees/availability-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyAvailability, useSaveMyAvailability } from "@/hooks/use-portal";

export function MyAvailability() {
  const { data: availability, isError } = useMyAvailability();
  const save = useSaveMyAvailability();

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell your managers when you can and can&apos;t work each week.
        </p>
      </div>
      {isError && (
        <p className="text-sm text-destructive">Couldn&apos;t load your availability.</p>
      )}
      {availability ? (
        <AvailabilityEditor
          availability={availability}
          onSave={(blocks) => save.mutateAsync(blocks)}
          description="Mark times you can't work, and times you'd like to be scheduled. Anything else counts as available."
        />
      ) : (
        !isError && <Skeleton className="h-[28rem]" />
      )}
    </div>
  );
}
