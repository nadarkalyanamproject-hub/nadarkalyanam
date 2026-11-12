// "Left at payment": a member who opened the payment window (which creates an
// order) and still hasn't paid two days later. Staff follow these accounts up,
// so they are listed one row per member and per kind of purchase, not one row
// per order.

export const UNPAID_CHECKOUT_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

// Orders that count as an unpaid attempt: never paid (CREATED) or the payment
// failed (FAILED). CANCELLED/REFUNDED are decisions, not drop-offs.
export const UNPAID_ORDER_STATUSES = ['CREATED', 'FAILED'] as const;

export interface UnpaidAttempt {
  id: string;
  userId: string;
  kind: string;
  status: string;
  amountInPaise: number;
  createdAt: Date;
  wanted: string;
}

export interface PaidOrderRef {
  userId: string;
  kind: string;
  createdAt: Date;
}

export interface UnpaidCheckoutRow {
  userId: string;
  kind: string;
  wanted: string;
  amountInPaise: number;
  attempts: number;
  lastStatus: string;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
  daysSinceLastAttempt: number;
  lastOrderId: string;
}

// Groups unpaid attempts by member and kind and keeps a group only when
//  - the newest attempt is at least two days old (younger ones may still pay),
//  - and the member has not paid for that kind since the newest attempt
//    (paying with a fresh order means they did not drop off).
// Newest drop-offs first.
export function buildUnpaidCheckouts(unpaid: UnpaidAttempt[], paid: PaidOrderRef[], now: Date): UnpaidCheckoutRow[] {
  const groups = new Map<string, UnpaidAttempt[]>();
  for (const attempt of unpaid) {
    const key = `${attempt.userId}|${attempt.kind}`;
    const list = groups.get(key) ?? [];
    list.push(attempt);
    groups.set(key, list);
  }

  const rows: UnpaidCheckoutRow[] = [];
  for (const attempts of groups.values()) {
    attempts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const first = attempts[0]!;
    const last = attempts[attempts.length - 1]!;
    if (now.getTime() - last.createdAt.getTime() < UNPAID_CHECKOUT_AFTER_MS) continue;
    const paidSince = paid.some((p) => p.userId === last.userId && p.kind === last.kind && p.createdAt >= last.createdAt);
    if (paidSince) continue;
    rows.push({
      userId: last.userId,
      kind: last.kind,
      wanted: last.wanted,
      amountInPaise: last.amountInPaise,
      attempts: attempts.length,
      lastStatus: last.status,
      firstAttemptAt: first.createdAt,
      lastAttemptAt: last.createdAt,
      daysSinceLastAttempt: Math.floor((now.getTime() - last.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
      lastOrderId: last.id,
    });
  }
  return rows.sort((a, b) => b.lastAttemptAt.getTime() - a.lastAttemptAt.getTime());
}
