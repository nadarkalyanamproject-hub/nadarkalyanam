"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { VipEnquiryStatus } from "@nadar-kalyanam/schemas";
import { Button, Card, Select, Textarea } from "@nadar-kalyanam/ui";
import { AdminShell } from "../../components/admin-shell";
import { GrantDialog } from "../../components/billing-ui";
import { ApiError } from "../../lib/api-client";
import {
  addVipNote,
  formatDate,
  getVipEnquiry,
  listVipEnquiries,
  updateVipEnquiry,
  vipAssignees,
  type AdminVipEnquiry,
  type AdminVipEnquiryDetail,
} from "../../lib/billing-api";
import { useCurrentAdmin } from "../../lib/use-current-admin";
import { useRequireAdminAuth } from "../../lib/use-require-admin-auth";
import { useAdminAuth } from "../providers/admin-auth-provider";

// Mirrors the API's status flow (VIP_STATUS_FLOW).
const NEXT: Record<VipEnquiryStatus, VipEnquiryStatus[]> = {
  NEW: ["CONTACTED", "CLOSED"],
  CONTACTED: ["ONBOARDED", "CLOSED"],
  ONBOARDED: [],
  CLOSED: [],
};
const PAGE = 25;

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function historyLine(h: AdminVipEnquiryDetail["history"][number]): string {
  if (h.kind === "STATUS")
    return `Status ${h.fromValue ?? "—"} → ${h.toValue ?? "—"}`;
  if (!h.toValue) return `Unassigned (was ${h.fromValue ?? "nobody"})`;
  return `Assigned to ${h.toValue}${h.fromValue ? ` (was ${h.fromValue})` : ""}`;
}

// One enquiry, opened: actions, internal notes (append-only) and history.
function EnquiryDetail({
  enquiry,
  assignees,
  myId,
  canGrant,
  token,
  onUpdated,
  onGrant,
  onClose,
}: {
  enquiry: AdminVipEnquiryDetail;
  assignees: { id: string; email: string }[];
  myId: string | null;
  canGrant: boolean;
  token: string;
  onUpdated: (e: AdminVipEnquiryDetail, message: string) => void;
  onGrant: (e: AdminVipEnquiry) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAssignMe =
    myId !== null &&
    assignees.some((a) => a.id === myId) &&
    enquiry.assignedAdminId !== myId;

  async function run(
    action: () => Promise<AdminVipEnquiryDetail>,
    message: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await action(), message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl p-5 shadow-sm" data-testid="vip-detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/members/${enquiry.userId}`}
            className="text-lg font-semibold text-primary hover:underline"
          >
            {enquiry.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {enquiry.phone} · received {dateTime(enquiry.createdAt)}
          </p>
          {enquiry.message && (
            <p className="mt-1 text-sm text-foreground">“{enquiry.message}”</p>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold"
          data-testid="vip-detail-status"
        >
          {enquiry.status}
        </span>
        <span
          className="text-muted-foreground"
          data-testid="vip-detail-assignee"
        >
          {enquiry.assignedAdminEmail
            ? `Assigned to ${enquiry.assignedAdminEmail}`
            : "Unassigned"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {NEXT[enquiry.status].map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                () => updateVipEnquiry(token, enquiry.id, { status: s }),
                `Marked ${s.toLowerCase()}.`,
              )
            }
          >
            Mark {s.toLowerCase()}
          </Button>
        ))}
        {canAssignMe && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid="vip-assign-me"
            onClick={() =>
              void run(
                () =>
                  updateVipEnquiry(token, enquiry.id, {
                    assignedAdminId: myId,
                  }),
                "Assigned to you.",
              )
            }
          >
            Assign to me
          </Button>
        )}
        <Select
          aria-label="Assign to"
          value={enquiry.assignedAdminId ?? ""}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value || null;
            void run(
              () =>
                updateVipEnquiry(token, enquiry.id, { assignedAdminId: next }),
              next ? "Assignee changed." : "Unassigned.",
            );
          }}
          className="w-auto"
        >
          <option value="">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
            </option>
          ))}
        </Select>
        {canGrant && (
          <Button
            type="button"
            size="sm"
            onClick={() => onGrant(enquiry)}
            data-testid="vip-grant"
          >
            Grant VIP plan
          </Button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <h3 className="mt-5 text-sm font-bold">Internal notes</h3>
      <p className="text-xs text-muted-foreground">
        Only admins see these. Notes can&apos;t be edited or deleted.
      </p>
      {enquiry.notes.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="mt-2 space-y-2" data-testid="vip-notes">
          {enquiry.notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-border p-2.5 text-sm"
            >
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.authorEmail} · {dateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          aria-label="New note"
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an internal note"
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={busy || !note.trim()}
          data-testid="vip-add-note"
          onClick={() =>
            void run(async () => {
              const updated = await addVipNote(token, enquiry.id, note.trim());
              setNote("");
              return updated;
            }, "Note added.")
          }
        >
          Add note
        </Button>
      </div>

      <h3 className="mt-5 text-sm font-bold">History</h3>
      {enquiry.history.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No changes yet.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm" data-testid="vip-history">
          {enquiry.history.map((h, i) => (
            <li key={i}>
              {historyLine(h)}{" "}
              <span className="text-xs text-muted-foreground">
                · {h.byEmail} · {dateTime(h.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function VipEnquiriesPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { admin, can } = useCurrentAdmin();
  const [status, setStatus] = useState<VipEnquiryStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const [offset, setOffset] = useState(0);
  const [list, setList] = useState<{
    items: AdminVipEnquiry[];
    total: number;
  } | null>(null);
  const [assignees, setAssignees] = useState<{ id: string; email: string }[]>(
    [],
  );
  const [open, setOpen] = useState<AdminVipEnquiryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [granting, setGranting] = useState<AdminVipEnquiry | null>(null);

  const load = useCallback(() => {
    if (!data.accessToken) return;
    listVipEnquiries(data.accessToken, {
      status: status || undefined,
      assignee: assignee || undefined,
      offset,
      limit: PAGE,
    })
      .then((r) => {
        setList(r);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError ? err.message : "Could not load enquiries.",
        ),
      );
  }, [data.accessToken, status, assignee, offset]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    vipAssignees(data.accessToken)
      .then((r) => setAssignees(r.items))
      .catch(() => {});
  }, [ready, data.accessToken]);

  async function openEnquiry(id: string) {
    try {
      setOpen(await getVipEnquiry(data.accessToken!, id));
      setMessage(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not open the enquiry.",
      );
    }
  }

  if (!ready) return null;
  return (
    <AdminShell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              VIP enquiries
            </h1>
            <p className="text-sm text-muted-foreground">
              Members who asked to be called about VIP Assisted, on their
              registered number.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as VipEnquiryStatus | "");
                setOffset(0);
              }}
              aria-label="Status"
              className="w-auto"
            >
              <option value="">All statuses</option>
              {(["NEW", "CONTACTED", "ONBOARDED", "CLOSED"] as const).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </Select>
            <Select
              value={assignee}
              onChange={(e) => {
                setAssignee(e.target.value);
                setOffset(0);
              }}
              aria-label="Assignee"
              className="w-auto"
            >
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {message && (
          <Card
            className="rounded-2xl p-4 text-sm text-muted-foreground"
            role="status"
          >
            {message}
          </Card>
        )}
        {error && (
          <Card
            className="rounded-2xl p-4 text-sm text-destructive"
            role="alert"
          >
            {error}
          </Card>
        )}

        {open && (
          <EnquiryDetail
            key={open.id}
            enquiry={open}
            assignees={assignees}
            myId={admin?.id ?? null}
            canGrant={can("subscriptions.manage")}
            token={data.accessToken!}
            onUpdated={(e, msg) => {
              setOpen(e);
              setMessage(msg);
              load();
            }}
            onGrant={setGranting}
            onClose={() => setOpen(null)}
          />
        )}

        {list === null && !error && (
          <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
            Loading…
          </Card>
        )}
        {list?.items.length === 0 && (
          <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
            No enquiries match.
          </Card>
        )}
        {list && list.items.length > 0 && (
          <Card className="overflow-x-auto rounded-2xl p-0 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Assigned to</th>
                  <th className="px-4 py-2">Notes</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.items.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-border"
                    data-testid="vip-row"
                    data-status={e.status}
                  >
                    <td className="px-4 py-2">
                      <p className="font-semibold">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.phone}</p>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold"
                        data-testid="vip-status"
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {e.assignedAdminEmail ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {e.noteCount}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(e.updatedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void openEnquiry(e.id)}
                        data-testid="vip-open"
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {list && list.total > PAGE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {offset + 1}–{Math.min(offset + PAGE, list.total)} of {list.total}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={offset + PAGE >= list.total}
                onClick={() => setOffset(offset + PAGE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      {granting && (
        <GrantDialog
          member={{
            userId: granting.userId,
            label: `${granting.name} · ${granting.phone}`,
          }}
          planCode="VIP_ASSISTED"
          onClose={() => setGranting(null)}
          onGranted={(s) =>
            setMessage(
              `${s.plan.name} granted to ${granting.name} (${formatDate(s.startedAt)} – ${formatDate(s.expiresAt)}).`,
            )
          }
        />
      )}
    </AdminShell>
  );
}
