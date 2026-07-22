import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import CoachModeBanner from "@/components/coach-mode-banner";
import ContentWidth from "@/components/content-width";
import MobileNav from "@/components/mobile-nav";
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
          <div className="flex items-center gap-2">
            <MobileNav />
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <SyncButton />
            <UserButton />
          </div>
        </header>

        <main className="flex-1 flex flex-col">
          <ContentWidth>{children}</ContentWidth>
        </main>
      </div>
    </div>
  );
}
