import { getSession } from '../http';
import { User } from './user';

export async function getActiveUser() {
  const session = await getSession();

  if (session) {
    return new User(session);
  }

  return null;
}
