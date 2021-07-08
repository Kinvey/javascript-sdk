const store = new Map();

export async function get(key: string) {
  return store.get(key);
}

export async function set(key: string, session: string) {
  store.set(key, session);
  return true;
}

export async function remove(key: string): Promise<boolean> {
  return store.delete(key);
}
