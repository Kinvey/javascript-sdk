const _cache = {};

export class KeyValuePersister {
  /** @type {Boolean} */
  _cacheEnabled;
  /** @type {Number} */
  _ttl;

  // TODO: implement TTL, make _cache a constructor argument?
  constructor(cacheEnabled = false, ttl = Infinity) {
    this._cacheEnabled = cacheEnabled;
    this._ttl = ttl;
  }

  read(key) {
    if (this._cacheEnabled && _cache[key]) {
      return Promise.resolve(_cache[key]);
    }

    return this._readFromPersistance(key)
      .then((entities) => {
        if (this._cacheEnabled) {
          _cache[key] = entities;
        }
        return entities;
      });
  }

  write(key, value) {
    if (this._cacheEnabled) {
      delete _cache[key];
    }
    return this._writeToPersistance(key, value)
      .then((result) => {
        if (this._cacheEnabled && this._ttl < Infinity) {
          setTimeout(() => {
            delete _cache[key];
          }, this._ttl);
        }
        return result;
      });
  }

  delete(key) {
    if (this._cacheEnabled) {
      delete _cache[key];
    }
    return this._deletePersistance(key);
  }

  getKeys() {
    this._throwNotImplementedError();
  }

  _throwNotImplementedError() {
    throw new Error('Abstract method not implemented');
  }

  _readFromPersistance(key) {
    this._throwNotImplementedError(key);
  }

  _writeToPersistance(key, array) {
    this._throwNotImplementedError(key, array);
  }

  _deletePersistance(key) {
    this._throwNotImplementedError(key);
  }
}
