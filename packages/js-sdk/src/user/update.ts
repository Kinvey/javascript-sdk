import { getActiveUser } from './getActiveUser';

export async function update(data: any, options?: { timeout?: number }) {
  const activeUser = await getActiveUser();

  if (activeUser) {
    return activeUser.update(data, options);
  }

  return null;
}
