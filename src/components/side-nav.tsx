"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/cn";
import { NAV_LINKS } from "@/lib/nav-links";
import { Logo } from "./logo";
import SyncButton from "./sync-button";

export default function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-neutral-800 sticky top-0 h-screen">
      <div className="px-5 h-14 flex items-center border-b border-neutral-800 shrink-0">
        <Logo />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-accent-500/10 text-accent-300"
                : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-accent-500/10 text-accent-300"
              : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60"
          )}
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
      <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
        <SyncButton />
        <UserButton />
      </div>
    </aside>
  );
}
