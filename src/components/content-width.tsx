"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

// Most pages read best in a centered, fixed-width column. The plan calendar is
// a wide 7-day grid, so it opts into the full width of the main content area.
const FULL_WIDTH_ROUTES = ["/plan"];

export default function ContentWidth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullWidth = FULL_WIDTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  return (
    <div
      className={cn(
        "flex-1 flex flex-col w-full",
        !fullWidth && "md:max-w-4xl md:mx-auto",
      )}
    >
      {children}
    </div>
  );
}
