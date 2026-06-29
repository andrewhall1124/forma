import { UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Forma</h1>
        <p className="mt-2 text-neutral-400">Your personal health dashboard</p>
      </div>
      <UserButton />
    </main>
  );
}
