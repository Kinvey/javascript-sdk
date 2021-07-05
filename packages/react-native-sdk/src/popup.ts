import { parse, UrlWithParsedQuery } from 'url';
import { EventEmitter } from 'events';
import { Linking } from 'react-native'
import { InAppBrowser } from 'react-native-inappbrowser-reborn'

const LOADED_EVENT = 'loaded';
const CLOSED_EVENT = 'closed';
const ERROR_EVENT = 'error';

class PopupBrowser extends EventEmitter {
  private authUrl: UrlWithParsedQuery;
  private isOpen: boolean = false;
  private isRedirected: boolean = false;
  private authPromise: Promise<any>;

  isClosed() {
    return !this.isOpen;
  }

  onLoaded(listener: (...args: any[]) => void) {
    return this.on(LOADED_EVENT, listener);
  }

  onClosed(listener: (...args: any[]) => void) {
    return this.on(CLOSED_EVENT, listener);
  }

  onError(listener: (...args: any[]) => void) {
    return this.on(ERROR_EVENT, listener);
  }

  handleDeeplinkCallback({ url }) {
    if (this.isRedirected) {
      return;
    }

    // Check if this is the expected callback
    if (url && url.indexOf(this.authUrl.query.redirect_uri) === 0) {
      this.isRedirected = true;
      this.emit(LOADED_EVENT, { url });
    }
  }

  async open(url: string): Promise<PopupBrowser> {
    if (await InAppBrowser.isAvailable() == false) {
      throw new Error('In-app browser not available.');
    }

    this.authUrl = parse(url, true);;
    Linking.addEventListener('url', this.handleDeeplinkCallback.bind(this));

    this.isOpen = true;
    this.authPromise = InAppBrowser.openAuth(url, null)
      .then((authResult) => {
        const loadedArgs = { url };

        // If result is not successful, just wait for handleDeeplinkCallback to be called
        if (authResult.type === 'success' && authResult.url) {
          loadedArgs.url = authResult.url; // Provide the full url containing the auth code
          this.isRedirected = true;
          this.emit(LOADED_EVENT, loadedArgs);
        }
      })
      .catch((err) => {
        this.emit(ERROR_EVENT, err);
      });

    return this;
  }

  async close(): Promise<void> {
    Linking.removeEventListener('url', this.handleDeeplinkCallback);

    this.isOpen = false;
    this.isRedirected = false;
    this.authPromise = null;
    this.emit(CLOSED_EVENT);
  }
}

export async function open(url: string): Promise<PopupBrowser> {
  const popup = new PopupBrowser();
  return popup.open(url);
}
