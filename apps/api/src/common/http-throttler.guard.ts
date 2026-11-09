import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// The app-wide request limit, for HTTP only. The realtime chat gateway
// (socket.io) has no HTTP request/response, which the stock guard reads for
// the IP and the rate-limit headers, so websocket events pass through.
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    return super.canActivate(context);
  }
}
