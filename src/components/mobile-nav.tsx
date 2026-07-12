"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_LINKS, SECONDARY_LINKS } from "@/lib/nav-links";
import { Logo } from "./logo";

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (typeof NAV_LINKS)[number]["icon"];
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-accent-500/10 text-accent-300"
          : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60"
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close the drawer whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The overlay is portalled to <body> so it isn't trapped by the header's
  // backdrop-blur: backdrop-filter makes an element a containing block for
  // fixed-position descendants (notably on iOS Safari), which would otherwise
  // clamp the drawer to the header strip instead of the viewport.
  const overlay = (
    <div className={cn("fixed inset-0 z-30 md:hidden", !open && "pointer-events-none")}>
        <div
          className={cn(
            "absolute inset-0 bg-black/60 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-64 max-w-[80%] flex flex-col border-r border-neutral-800 bg-neutral-950 transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="px-5 h-14 flex items-center justify-between border-b border-neutral-800 shrink-0">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="p-1 text-neutral-500 hover:text-neutral-200"
            >
              <X size={18} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {NAV_LINKS.map((l) => (
              <NavItem key={l.href} {...l} active={pathname === l.href} />
            ))}
          </nav>
          <div className="px-3 pb-4 pt-2 border-t border-neutral-800 space-y-0.5">
            {SECONDARY_LINKS.map((l) => (
              <NavItem key={l.href} {...l} active={pathname === l.href} />
            ))}
          </div>
        </aside>
      </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
      >
        <Menu size={18} />
      </button>

      {mounted && createPortal(overlay, document.body)}
    </>
  );
}
