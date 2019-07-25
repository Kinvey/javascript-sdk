import isArray from 'lodash/isArray';
import PQueue from 'p-queue';
import { KinveyError } from '../errors';
import { KmdObject } from '../kmd';
import { AclObject } from '../acl';
import { generateId } from './utils';

const QUEUE = new PQueue({ concurrency: 1 });

export interface Doc {
  _id?: string;
  _acl?: AclObject;
  _kmd?: KmdObject;
}

export interface StorageAdapter<T extends Doc> {
  count(namespace: string, collectionName: string): Promise<number>;
  find(namespace: string, collectionName: string): Promise<T[]>;
  findById(namespace: string, collectionName: string, id: string): Promise<T>;
  save(namespace: string, collectionName: string, docs: T[]): Promise<T[]>;
  removeById(namespace: string, collectionName: string, id: string): Promise<number>;
  clear(namespace: string, collectionName: string): Promise<number>;
  clearDatabase(namespace: string, exclude?: string[]): Promise<void>;
}

let adapter;

export function setStorageAdapter(_adapter: StorageAdapter<Doc>): void {
  adapter = _adapter;
}

export function getStorageAdapter<T extends Doc>(): StorageAdapter<T> {
  return adapter;
}

export class Storage<T extends Doc> {
  public namespace: string;
  public collectionName: string;

  constructor(namespace: string, collectionName: string) {
    this.namespace = namespace;
    this.collectionName = collectionName;
  }

  // eslint-disable-next-line class-methods-use-this
  get storageAdapter(): StorageAdapter<T> {
    const _adapter = getStorageAdapter<T>();
    if (!_adapter) {
      throw new KinveyError('You must override the default storage adapter with a platform specific storage adapter.');
    }
    return _adapter;
  }

  count(): Promise<number> {
    return QUEUE.add((): Promise<number> => this.storageAdapter.count(this.namespace, this.collectionName));
  }

  find(): Promise<T[]> {
    return QUEUE.add((): Promise<T[]> => this.storageAdapter.find(this.namespace, this.collectionName));
  }

  findById(id: string): Promise<T> {
    return QUEUE.add((): Promise<T> => this.storageAdapter.findById(this.namespace, this.collectionName, id));
  }

  save(docsToSave: T): Promise<T>;
  save(docsToSave: T[]): Promise<T[]>;
  async save(docsToSave: any): Promise<any> {
    if (!isArray(docsToSave)) {
      const savedDocs = await this.save([docsToSave]);
      return savedDocs.shift();
    }

    return QUEUE.add(
      async (): Promise<T[]> => {
        // Clone the docs
        let docs = docsToSave.slice(0, docsToSave.length);

        // Add _id if it is missing
        if (docs.length > 0) {
          docs = docs.map(
            (doc: Doc): Doc => {
              if (!doc._id) {
                return Object.assign({}, doc, {
                  _id: generateId(),
                  _kmd: Object.assign({}, doc._kmd, { local: true })
                });
              }
              return doc;
            }
          );
        }

        await this.storageAdapter.save(this.namespace, this.collectionName, docs);
        return docs;
      }
    );
  }

  removeById(id: string): Promise<number> {
    return QUEUE.add((): Promise<number> => this.storageAdapter.removeById(this.namespace, this.collectionName, id));
  }

  clear(): Promise<number> {
    return QUEUE.add((): Promise<number> => this.storageAdapter.clear(this.namespace, this.collectionName));
  }
}
