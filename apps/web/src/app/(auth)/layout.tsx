import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Link href="/" aria-label="Crewline home" className="mb-8">
        <Logo />
      </Link>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
