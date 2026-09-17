import { Button } from '@nadar-kalyanam/ui';

export default function AdminHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">Nadar Kalyanam Admin</h1>
      <p className="text-muted-foreground">
        Admin back-office — scaffolded. RBAC, moderation, verification and finance dashboards
        land in Phase 11.
      </p>
      <Button variant="primary">Sign in</Button>
    </main>
  );
}
