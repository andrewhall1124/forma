import { Home, UtensilsCrossed, Droplets, Activity, Moon, LucideIcon } from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/water", label: "Water", icon: Droplets },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/sleep", label: "Sleep", icon: Moon },
];
