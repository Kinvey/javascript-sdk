import { User } from './user';
import { mergeSocialIdentity } from './utils';
import { setSession } from '../http';
import { executeLoginRequest } from './login';

export async function loginWithSocialIdentity(socialIdentity: any): Promise<User> {
  const { user } = await executeLoginRequest({ _socialIdentity: socialIdentity });
  user._socialIdentity = mergeSocialIdentity(socialIdentity, user._socialIdentity);
  await setSession(user);
  return new User(user);
}
