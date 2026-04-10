interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}
