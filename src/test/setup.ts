import '@testing-library/jest-dom/vitest';

// Provide no-op BroadcastChannel for components/hooks that expect it.
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners: Array<(event: MessageEvent) => void> = [];

  constructor(name: string) {
    this.name = name;
  }

  postMessage(data: unknown) {
    const event = new MessageEvent('message', { data });
    for (const listener of this.listeners) {
      listener(event);
    }
    if (this.onmessage) {
      this.onmessage(event);
    }
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter((current) => current !== listener);
  }

  close() {
    this.listeners = [];
    this.onmessage = null;
  }
}

// @ts-expect-error allow assignment for test env
global.BroadcastChannel = MockBroadcastChannel;
