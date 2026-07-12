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
// mobile "More" sheet, but never in the main nav list.
export const SECONDARY_LINKS: NavLink[] = [
  { href: "/coach", label: "Coach", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

// The handful of NAV_LINKS surfaced as top-level tabs on the mobile bottom
// bar; everything else collapses behind "More" (see components/nav.tsx). Bottom
// tab bars work best at ~5 items, so keep this short.
export const MOBILE_PRIMARY_HREFS = ["/", "/plan", "/meals", "/activities"];
