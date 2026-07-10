class BroadcastManager {
  constructor(role) {
    this.role = role;
    this.channelName = 'perya-color-game';
    this.handlers = new Map();
    this.channel = null;

    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = event => this.handleMessage(event.data);
    }
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
  }

  off(type, handler) {
    if (!this.handlers.has(type)) return;
    this.handlers.get(type).delete(handler);
  }

  send(type, payload = {}) {
    if (!this.channel) return;
    this.channel.postMessage({
      type,
      payload,
      role: this.role,
      sentAt: Date.now()
    });
  }

  handleMessage(message) {
    if (!message || typeof message.type !== 'string') return;
    const handlers = this.handlers.get(message.type);
    if (!handlers) return;
    for (const handler of handlers) handler(message.payload || {}, message);
  }

  close() {
    if (this.channel) this.channel.close();
  }
}
