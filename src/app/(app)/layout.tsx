import { UserButton } from "@clerk/nextjs";
import Nav from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <span className="text-lg font-bold tracking-tight">Forma</span>
        <UserButton />
      </header>
      <main className="flex-1 pb-20">
        {children}
      </main>
      <Nav />
    </div>
  );
}
