import { Home, UtensilsCrossed, Droplets, Activity, Moon, Footprints, ClipboardList, Scale, Users, Settings, LucideIcon } from "lucide-react";

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
  { href: "/body-composition", label: "Body", icon: Scale },
];

// Utility destinations that live in the sidebar footer (desktop) and the
// bottom of the mobile drawer, but never in the main nav list.
export const SECONDARY_LINKS: NavLink[] = [
  { href: "/coach", label: "Coaching", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];
