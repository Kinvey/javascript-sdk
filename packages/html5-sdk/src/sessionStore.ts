export async function get(key: string): Promise<string> {
  return window.localStorage.getItem(key);
}

export async function set(key: string, session: string): Promise<boolean> {
  window.localStorage.setItem(key, session);
  return true;
}

export async function remove(key: string): Promise<boolean> {
  window.localStorage.removeItem(key);
  return true;
}
