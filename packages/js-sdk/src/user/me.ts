import { getActiveUser } from './getActiveUser';

export async function me(options?: { timeout?: number }) {
  const activeUser = await getActiveUser();

  if (activeUser) {
    return activeUser.me(options);
  }

  return null;
}
