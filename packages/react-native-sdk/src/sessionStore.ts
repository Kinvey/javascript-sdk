import * as keychain from 'react-native-keychain';

export async function get(key: string): Promise<string> {
  const credentials = await keychain.getGenericPassword({ service: key })
  return credentials ? credentials.password : null;
}

export async function set(key: string, session: string): Promise<boolean> {
  return keychain.setGenericPassword(key, session, { service: key }).then(result => !!result);
}

export async function remove(key: string): Promise<boolean> {
  return keychain.resetGenericPassword({ service: key });
}
