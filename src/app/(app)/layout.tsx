import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import CoachModeBanner from "@/components/coach-mode-banner";
import Nav from "@/components/nav";
import SideNav from "@/components/side-nav";
import SyncButton from "@/components/sync-button";
import TimezoneSync from "@/components/timezone-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <TimezoneSync />
      <SideNav />

      <div className="flex-1 flex flex-col min-w-0">
        <CoachModeBanner />
        {/* Mobile-only header */}
        <header className="md:hidden sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
          <Logo />
          <div className="flex items-center gap-2">
            <SyncButton />
            <Link
              href="/settings"
              className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <Settings size={16} />
            </Link>
            <UserButton />
          </div>
        </header>

        <main className="flex-1 pb-20 md:pb-0 flex flex-col">
          <div className="flex-1 flex flex-col w-full md:max-w-4xl md:mx-auto">
            {children}
          </div>
        </main>

        <Nav />
      </div>
    </div>
  );
}
