import { SecureStorage } from '@nativescript/secure-storage';
import * as live from './live';

export async function get(key: string): Promise<string> {
  const secureStorage = new SecureStorage();
  return secureStorage.getSync({ key });
}

export async function set(key: string, session: string): Promise<boolean> {
  const secureStorage = new SecureStorage();
  const result = secureStorage.setSync({
    key,
    value: session
  });

  if (result) {
    live.startMonitoring();
  }

  return result;
}

export async function remove(key: string): Promise<boolean> {
  const secureStorage = new SecureStorage();
  const result = secureStorage.removeSync({ key });

  if (result) {
    live.stopMonitoring();
  }

  return result;
}
