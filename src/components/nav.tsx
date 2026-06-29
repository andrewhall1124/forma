"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, Droplets, Activity, Moon } from "lucide-react";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/water", label: "Water", icon: Droplets },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/sleep", label: "Sleep", icon: Moon },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-10 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="flex max-w-lg mx-auto">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 flex-1 py-3 text-xs",
              pathname === href
                ? "text-white"
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
