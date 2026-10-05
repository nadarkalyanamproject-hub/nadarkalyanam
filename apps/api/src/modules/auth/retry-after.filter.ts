import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { OtpRateLimitException } from './otp-rate-limiter.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
}

// Same JSON body Nest would send for the exception, plus the standard
// Retry-After header so clients (and proxies) know when to try again.
@Catch(OtpRateLimitException)
export class RetryAfterFilter implements ExceptionFilter {
  catch(exception: OtpRateLimitException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HeaderResponse>();
    response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
