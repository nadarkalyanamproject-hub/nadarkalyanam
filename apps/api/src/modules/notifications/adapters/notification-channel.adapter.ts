export const PUSH_CHANNEL_ADAPTER = Symbol('PUSH_CHANNEL_ADAPTER');
export const SMS_CHANNEL_ADAPTER = Symbol('SMS_CHANNEL_ADAPTER');
export const EMAIL_CHANNEL_ADAPTER = Symbol('EMAIL_CHANNEL_ADAPTER');

export interface NotificationChannelAdapter {
  send(userId: string, type: string, payload: Record<string, unknown>): Promise<void>;
}
