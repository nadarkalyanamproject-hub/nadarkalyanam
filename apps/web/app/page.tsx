import { Button } from '@nadar-kalyanam/ui';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">Nadar Kalyanam</h1>
      <p className="text-muted-foreground">
        Member web app — scaffolded. Auth, profiles, discovery and messaging land in the next
        development phases.
      </p>
      <Button variant="primary">Get started</Button>
    </main>
  );
}
