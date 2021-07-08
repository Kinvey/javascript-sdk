import { ConfigKey, getConfig } from '../config';
import { getAppKey } from '../kinvey';
import { Entity } from '../storage';

export interface SessionObject extends Entity {
  _socialIdentity?: any;
}

export interface SessionStore {
  get(key: string): Promise<string>;
  set(key: string, session: string): Promise<boolean>;
  remove(key: string): Promise<boolean>;
}

export interface MFASessionObject {
  userId: string;
  mfaSessionToken: string;
}

function getStore() {
  return getConfig<SessionStore>(ConfigKey.SessionStore);
}

export function getKey() {
  return `${getAppKey()}.active_user`;
}

async function _getObjectFromStore(key) {
  const obj = await getStore().get(key);
  if (!obj) {
    return null;
  }

  return JSON.parse(obj);
}

export async function getSession(): Promise<SessionObject> {
  return _getObjectFromStore(getKey());
}

async function _setObjectInStore(key, obj) {
  return getStore().set(key, JSON.stringify(obj));
}

export async function setSession(session: SessionObject): Promise<boolean> {
  return _setObjectInStore(getKey(), session);
}

export async function removeSession(): Promise<boolean> {
  return getStore().remove(getKey());
}

function getMFAKey(): string {
  return `${getAppKey()}.mfa_user`;
}

export async function getMFASession(): Promise<MFASessionObject> {
  return _getObjectFromStore(getMFAKey());
}

export async function getMFASessionToken(): Promise<string> {
  const mfaUser = await getMFASession();
  if (!mfaUser) {
    return null;
  }

  return mfaUser.mfaSessionToken;
}

export async function setMFASession(mfaSession: MFASessionObject): Promise<boolean> {
  return _setObjectInStore(getMFAKey(), mfaSession);
}

export async function removeMFASession(): Promise<boolean> {
  return getStore().remove(getMFAKey());
}

function getDeviceTokenKey(username: string): string {
  return `${getAppKey()}.${username}.device_token`;
}

export async function getDeviceToken(username: string): Promise<string> {
  return getStore().get(getDeviceTokenKey(username));
}

export async function hasDeviceToken(username: string): Promise<boolean> {
  const deviceToken = await getDeviceToken(username);
  return deviceToken != null;
}

export async function setDeviceToken(username: string, deviceToken: string): Promise<boolean> {
  return getStore().set(getDeviceTokenKey(username), deviceToken);
}

export async function removeDeviceToken(username: string): Promise<boolean> {
  return getStore().remove(getDeviceTokenKey(username));
}
