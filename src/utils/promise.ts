import { Promise } from 'es6-promise';


/**
 * @private
 */
const noop = function() {};

/**
 * @private
 */
function resolveWith(value) {
  if (value && typeof value.then === 'function') {
    return value;
  }

  return Promise.resolve(value);
}

/**
 * @private
 */
export class Queue {
  pendingPromises = 0;
  maxPendingPromises = Infinity;
  maxQueuedPromises = Infinity;
  queue = [];

  constructor(maxPendingPromises, maxQueuedPromises) {
    this.maxPendingPromises = typeof maxPendingPromises !== 'undefined' ? maxPendingPromises : Infinity;
    this.maxQueuedPromises = typeof maxQueuedPromises !== 'undefined' ? maxQueuedPromises : Infinity;
  }

  add(promiseGenerator) {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.maxQueuedPromises) {
        reject(new Error('Queue limit reached'));
        return;
      }

      this.queue.push({
        promiseGenerator: promiseGenerator,
        resolve: resolve,
        reject: reject
      });

      this._dequeue();
    });
  }

  getPendingLength() {
    return this.pendingPromises;
  }

  getQueueLength() {
    return this.queue.length;
  }

  _dequeue() {
    if (this.pendingPromises >= this.maxPendingPromises) {
      return false;
    }

    // Remove from queue
    const item = this.queue.shift();
    if (!item) {
      return false;
    }

    try {
      this.pendingPromises += 1;
      resolveWith(item.promiseGenerator())
        // Forward all stuff
        .then((value) => {
          // It is not pending now
          this.pendingPromises -= 1;
          // It should pass values
          item.resolve(value);
          this._dequeue();
        }, (err) => {
          // It is not pending now
          this.pendingPromises -= 1;
          // It should not mask errors
          item.reject(err);
          this._dequeue();
        }, (message) => {
          // It should pass notifications
          item.notify(message);
        });
    } catch (err) {
      this.pendingPromises -= 1;
      item.reject(err);
      this._dequeue();
    }

    return true;
  }
}
