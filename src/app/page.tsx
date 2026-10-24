import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="grid h-full place-items-center">
      <div className="fade-up flex flex-col items-center gap-6 text-center">
        <p className="eyebrow">Self-hosted · GDPR-first</p>
        <h1 className="title-sweep text-5xl font-semibold tracking-tight">Chat Engine</h1>
        <Button variant="chrome" size="lg">
          Get started
        </Button>
      </div>
    </main>
  );
}
