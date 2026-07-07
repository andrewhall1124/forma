import { Home, UtensilsCrossed, Droplets, Activity, Moon, Footprints, ClipboardList, LucideIcon } from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/plan", label: "Plan", icon: ClipboardList },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/water", label: "Water", icon: Droplets },
  { href: "/activities", label: "Activities", icon: Activity },
  { href: "/steps", label: "Steps", icon: Footprints },
  { href: "/sleep", label: "Sleep", icon: Moon },
];
