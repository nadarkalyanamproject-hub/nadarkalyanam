import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';
import { HttpThrottlerGuard } from './http-throttler.guard.js';

const contextOf = (type: string) => ({ getType: () => type }) as unknown as ExecutionContext;

describe('HttpThrottlerGuard', () => {
  it('lets websocket events through without counting them', async () => {
    const parent = vi.spyOn(ThrottlerGuard.prototype, 'canActivate');
    const guard = Object.create(HttpThrottlerGuard.prototype) as HttpThrottlerGuard;
    await expect(guard.canActivate(contextOf('ws'))).resolves.toBe(true);
    expect(parent).not.toHaveBeenCalled();
    parent.mockRestore();
  });

  it('applies the limit to HTTP requests', async () => {
    const parent = vi.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(false);
    const guard = Object.create(HttpThrottlerGuard.prototype) as HttpThrottlerGuard;
    await expect(guard.canActivate(contextOf('http'))).resolves.toBe(false);
    expect(parent).toHaveBeenCalledOnce();
    parent.mockRestore();
  });
});
