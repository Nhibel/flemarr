const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16_000];

interface JobStreamOptions {
  open: () => EventSource;
  onMessage: (data: string) => void;
  /**
   * The stream is back after a cut, its first message about to be delivered.
   * The server replays every event from the start.
   */
  onReplay: () => void;
  /** Every attempt failed. */
  onLost: () => void;
}

export interface JobStream {
  close: () => void;
}

/**
 * Follows a server-side job over SSE, reopening the stream when it is cut:
 * the job goes on without its listener. EventSource retries by itself on a
 * dropped connection, but gives up on an error answer (a proxy's 502).
 */
export function openJobStream({ open, onMessage, onReplay, onLost }: JobStreamOptions): JobStream {
  let source: EventSource;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let isClosed = false;

  const close = () => {
    isClosed = true;
    clearTimeout(timer);
    source.close();
  };

  const connect = (isReconnection: boolean) => {
    let isReplayPending = isReconnection;
    source = open();
    source.onmessage = (message: MessageEvent<string>) => {
      if (isClosed) return;
      failures = 0;
      if (isReplayPending) onReplay();
      isReplayPending = false;
      onMessage(message.data);
    };
    source.onerror = () => {
      if (isClosed) return;
      source.close();
      const delayMs = RETRY_DELAYS_MS[failures];
      failures++;
      if (delayMs === undefined) {
        close();
        onLost();
        return;
      }
      timer = setTimeout(() => connect(true), delayMs);
    };
  };

  connect(false);
  return { close };
}
