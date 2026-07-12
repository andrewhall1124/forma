"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_LINKS, SECONDARY_LINKS, MOBILE_PRIMARY_HREFS } from "@/lib/nav-links";

// Top-level tabs, in NAV_LINKS order.
const PRIMARY = NAV_LINKS.filter((l) => MOBILE_PRIMARY_HREFS.includes(l.href));
// Everything that doesn't get its own tab lives behind "More".
const OVERFLOW = [
  ...NAV_LINKS.filter((l) => !MOBILE_PRIMARY_HREFS.includes(l.href)),
  ...SECONDARY_LINKS,
];

export default function Nav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const moreActive = OVERFLOW.some((l) => l.href === pathname);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl border-t border-neutral-800 bg-neutral-900 p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-neutral-300">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {OVERFLOW.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs",
                    pathname === href
                      ? "bg-accent-500/10 text-accent-300"
                      : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                  )}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-10 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur md:hidden">
        <div className="flex">
          {PRIMARY.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-3 text-xs",
                pathname === href
                  ? "text-accent-400"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              "flex flex-col items-center gap-1 flex-1 py-3 text-xs",
              moreActive || moreOpen
                ? "text-accent-400"
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <MoreHorizontal size={20} />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
