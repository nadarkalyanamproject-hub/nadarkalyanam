'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Select } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import {
  ApiError,
  createAdmin,
  listAdmins,
  listRoles,
  updateAdmin,
  type AdminSummary,
  type RoleSummary,
} from '../../lib/api-client';
import { isValidLocalPhone, toE164 } from '../../lib/phone';
import { useCurrentAdmin } from '../../lib/use-current-admin';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

export default function AdminsPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { admin: me, can } = useCurrentAdmin();
  const [admins, setAdmins] = useState<AdminSummary[] | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    Promise.all([listAdmins(data.accessToken), listRoles(data.accessToken)])
      .then(([adminResult, roleResult]) => {
        if (cancelled) return;
        setAdmins(adminResult.items);
        setRoles(roleResult.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load admins.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, reloadKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!data.accessToken || !roleId || !isValidLocalPhone(phone)) return;
    setCreating(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const created = await createAdmin(data.accessToken, { phoneNumber: toE164(phone), email: email.trim(), roleId });
      setMessage(`Added ${created.email} as ${created.roleName}. They log in with ${created.phoneNumber} via OTP.`);
      setPhone('');
      setEmail('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add admin.');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(target: AdminSummary, change: { roleId?: string; isActive?: boolean }, success: string) {
    if (!data.accessToken) return;
    setPendingId(target.id);
    setError(undefined);
    setMessage(undefined);
    try {
      await updateAdmin(data.accessToken, target.id, change);
      setMessage(success);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update admin.');
    } finally {
      setPendingId(null);
      // Reload either way, so a rejected role change snaps the dropdown back.
      setReloadKey((k) => k + 1);
    }
  }

  if (!ready) return null;

  if (me && !can('admin_users.manage')) {
    return (
      <AdminShell>
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">You don&apos;t have access to admin management.</Card>
      </AdminShell>
    );
  }

  const phoneValid = isValidLocalPhone(phone);

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">Admins</h1>

        {error && <Card className="rounded-2xl p-4 text-sm text-destructive">{error}</Card>}
        {message && <Card className="rounded-2xl p-4 text-sm text-muted-foreground">{message}</Card>}

        <Card className="rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-primary">Add admin</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Admins log in with this phone number via OTP. Use a number that isn&apos;t a member&apos;s matrimonial
            account — no profile is created for it.
          </p>
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={(e) => void handleCreate(e)}>
            <Field label="Phone (+91)" htmlFor="new-admin-phone">
              <Input
                id="new-admin-phone"
                inputMode="numeric"
                placeholder="10-digit number"
                value={phone}
                invalid={phone.length > 0 && !phoneValid}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </Field>
            <Field label="Email" htmlFor="new-admin-email">
              <Input
                id="new-admin-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Role" htmlFor="new-admin-role">
              <Select id="new-admin-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={creating || !phoneValid || !email.trim() || !roleId}>
                {creating ? 'Adding…' : 'Add admin'}
              </Button>
            </div>
          </form>
        </Card>

        {admins === null && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}

        {admins && (
          <Card className="overflow-x-auto rounded-2xl p-0 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Access</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isMe = admin.id === me?.id;
                  const busy = pendingId === admin.id;
                  return (
                    <tr key={admin.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{admin.email}</span>
                        {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{admin.phoneNumber}</td>
                      <td className="px-4 py-3">
                        <Select
                          aria-label={`Role for ${admin.email}`}
                          className="h-9 w-48"
                          value={admin.roleId}
                          disabled={busy || isMe}
                          title={isMe ? 'You cannot change your own role' : undefined}
                          onChange={(e) => {
                            const next = roles.find((role) => role.id === e.target.value);
                            void handleUpdate(admin, { roleId: e.target.value }, `${admin.email} is now ${next?.name}.`);
                          }}
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              admin.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {admin.isActive ? 'Active' : 'Deactivated'}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy || (isMe && admin.isActive)}
                            title={isMe ? 'You cannot deactivate yourself' : undefined}
                            onClick={() => {
                              if (admin.isActive && !window.confirm(`Deactivate ${admin.email}? They lose admin access immediately.`)) {
                                return;
                              }
                              void handleUpdate(
                                admin,
                                { isActive: !admin.isActive },
                                `${admin.email} ${admin.isActive ? 'deactivated' : 'reactivated'}.`,
                              );
                            }}
                          >
                            {admin.isActive ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
