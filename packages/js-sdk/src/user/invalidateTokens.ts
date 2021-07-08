import { getActiveUser } from './getActiveUser';

export async function invalidateTokens() {
  const activeUser = await getActiveUser();

  if (!activeUser) {
    return null;
  }

  return activeUser.invalidateTokens();
}
