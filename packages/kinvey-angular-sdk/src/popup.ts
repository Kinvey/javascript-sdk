import { EventEmitter } from 'events';

const LOADED_EVENT = 'loaded';
const CLOSED_EVENT = 'closed';
const ERROR_EVENT = 'error';

class Popup extends EventEmitter {
  private popupWindow: Window;

  constructor(popupWindow: Window) {
    super();
    this.popupWindow = popupWindow;
    (this as any).interval = window.setInterval(() => {
      if (popupWindow.closed) {
        this.close();
      } else {
        try {
          const event = { url: popupWindow.location.href };
          (this as any).emit(LOADED_EVENT, event);
        } catch (error) {
          if (error.code !== (window as any).DOMException.SECURITY_ERR) {
            (this as any).emit(ERROR_EVENT, error);
          }
        }
      }
    }, 100);
  }

  isClosed() {
    return this.popupWindow.closed;
  }

  onLoaded(listener) {
    return (this as any).on(LOADED_EVENT, listener);
  }

  onClosed(listener) {
    return (this as any).on(CLOSED_EVENT, listener);
  }

  onError(listener) {
    return (this as any).on(ERROR_EVENT, listener);
  }

  async close() {
    if ((this as any).interval) {
      window.clearInterval((this as any).interval);
      (this as any).interval = null;
    }

    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
      this.popupWindow = null;
    }

    (this as any).emit(CLOSED_EVENT);
    return this;
  }
}

export default {
  open(url) {
    const popupWindow = window.open(url, '_blank', 'toolbar=no,location=no');

    if (!popupWindow) {
      throw new Error('The popup was blocked.');
    }

    return new Popup(popupWindow);
  }
};
