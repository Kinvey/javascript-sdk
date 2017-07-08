import Promise from 'es6-promise';
import map from 'lodash/map';
import assign from 'lodash/assign';
import isFunction from 'lodash/isFunction';
import isNumber from 'lodash/isNumber';
import url from 'url';

import {
  NetworkRequest,
  KinveyRequest,
  AuthType,
  RequestMethod,
  Headers
} from 'src/request';
import { KinveyError } from 'src/errors';
import { KinveyObservable, Log, isDefined } from 'src/utils';
import Query from 'src/query';
import NetworkStore from './networkstore';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Calculate where we should start the file upload
function getStartIndex(rangeHeader, max) {
  const start = rangeHeader ? parseInt(rangeHeader.split('-')[1], 10) + 1 : 0;
  return start >= max ? max - 1 : start;
}

/**
 * The FileStore class is used to find, save, update, remove, count and group files.
 */
export default class FileStore extends NetworkStore {
  /**
   * @private
   * The pathname for the store.
   *
   * @return  {string}  Pathname
   */
  get pathname() {
    return `/blob/${this.client.appKey}`;
  }

  /**
   * Finds all files. A query can be optionally provided to return
   * a subset of all the files for your application or omitted to return all the files.
   * The number of files returned will adhere to the limits specified
   * at http://devcenter.kinvey.com/rest/guides/datastore#queryrestrictions. A
   * promise will be returned that will be resolved with the files or rejected with
   * an error.
   *
   * @param   {Query}                 [query]                                   Query used to filter result.
   * @param   {Object}                [options]                                 Options
   * @param   {Properties}            [options.properties]                      Custom properties to send with
   *                                                                            the request.
   * @param   {Number}                [options.timeout]                         Timeout for the request.
   * @param   {Boolean}               [options.tls]                             Use Transport Layer Security
   * @param   {Boolean}               [options.download]                        Download the files
   * @return  {Promise}                                                         Promise
   *
   * @example
   * var filesStore = new Kinvey.FilesStore();
   * var query = new Kinvey.Query();
   * query.equalTo('location', 'Boston');
   * files.find(query, {
   *   tls: true, // Use transport layer security
   *   ttl: 60 * 60 * 24, // 1 day in seconds
   *   download: true // download the files
   * }).then(function(files) {
   *   ...
   * }).catch(function(err) {
   *   ...
   * });
   */
  find(query, options = {}) {
    options = assign({ tls: true }, options);
    const queryStringObject = { tls: options.tls === true };

    if (isNumber(options.ttl)) {
      queryStringObject.ttl_in_seconds = parseInt(options.ttl, 10);
    }

    const stream = KinveyObservable.create((observer) => {
      // Check that the query is valid
      if (isDefined(query) && !(query instanceof Query)) {
        return observer.error(new KinveyError('Invalid query. It must be an instance of the Query class.'));
      }

      // Create the request
      const request = new KinveyRequest({
        method: RequestMethod.GET,
        authType: AuthType.Default,
        url: url.format({
          protocol: this.client.apiProtocol,
          host: this.client.apiHost,
          pathname: this.pathname,
          query: queryStringObject
        }),
        properties: options.properties,
        query: query,
        timeout: options.timeout,
        client: this.client
      });
      return request.execute()
        .then(response => response.data)
        .then(data => observer.next(data))
        .then(() => observer.complete())
        .catch(error => observer.error(error));
    });
    return stream.toPromise()
      .then((files) => {
        if (options.download === true) {
          return Promise.all(map(files, file => this.downloadByUrl(file._downloadURL, options)));
        }

        return files;
      });
  }

  findById(id, options) {
    return this.download(id, options);
  }

  /**
   * Download a file.
   *
   * @param   {string}        name                                          Name
   * @param   {Object}        [options]                                     Options
   * @param   {Boolean}       [options.tls]                                 Use Transport Layer Security
   * @param   {Number}        [options.ttl]                                 Time To Live (in seconds)
   * @param   {Boolean}       [options.stream=false]                        Stream the file
   * @return  {Promise<string>}                                             File content
   *
   * @example
   * var files = new Kinvey.Files();
   * files.download('Kinvey.png', {
   *   tls: true, // Use transport layer security
   *   ttl: 60 * 60 * 24, // 1 day in seconds
   *   stream: true // stream the file
   * }).then(function(file) {
   *   ...
   * }).catch(function(err) {
   *   ...
   * });
  */
  download(name, options = {}) {
    options = assign({ tls: true }, options);
    const queryStringObject = { tls: options.tls === true };

    if (isNumber(options.ttl)) {
      queryStringObject.ttl_in_seconds = parseInt(options.ttl, 10);
    }

    const stream = KinveyObservable.create((observer) => {
      if (isDefined(name) === false) {
        observer.next(undefined);
        return observer.complete();
      }

      const request = new KinveyRequest({
        method: RequestMethod.GET,
        authType: AuthType.Default,
        url: url.format({
          protocol: this.client.apiProtocol,
          host: this.client.apiHost,
          pathname: `${this.pathname}/${name}`,
          query: queryStringObject
        }),
        properties: options.properties,
        timeout: options.timeout,
        client: this.client
      });
      return request.execute()
        .then(response => response.data)
        .then(data => observer.next(data))
        .then(() => observer.complete())
        .catch(error => observer.error(error));
    });
    return stream.toPromise()
      .then((file) => {
        if (options.stream === true) {
          return file;
        }

        options.mimeType = file.mimeType;
        return this.downloadByUrl(file._downloadURL, options);
      });
  }

  /**
   * Download a file using a url.
   *
   * @param   {string}        url                                           File download url
   * @param   {Object}        [options]                                     Options
   * @return  {Promise<string>}                                             File content.
  */
  downloadByUrl(url, options = {}) {
    const request = new NetworkRequest({
      method: RequestMethod.GET,
      url: url,
      timeout: options.timeout
    });
    return request.execute().then(response => response.data);
  }

  /**
   * Stream a file. A promise will be returned that will be resolved with the file or rejected with
   * an error.
   *
   * @param   {string}        name                                          File name
   * @param   {Object}        [options]                                     Options
   * @param   {Boolean}       [options.tls]                                 Use Transport Layer Security
   * @param   {Number}        [options.ttl]                                 Time To Live (in seconds)
   * @param   {DataPolicy}    [options.dataPolicy=DataPolicy.NetworkFirst]    Data policy
   * @param   {AuthType}      [options.authType=AuthType.Default]           Auth type
   * @return  {Promise}                                                     Promise
   *
   * @example
   * var files = new Kinvey.Files();
   * files.stream('BostonTeaParty.png', {
   *   tls: true, // Use transport layer security
   *   ttl: 60 * 60 * 24, // 1 day in seconds
   * }).then(function(file) {
   *   ...
   * }).catch(function(err) {
   *   ...
   * });
   */
  stream(name, options = {}) {
    options.stream = true;
    return this.download(name, options);
  }

  /**
   * Upload a file.
   *
   * @param {Blob|string} file  File content
   * @param {Object} [metadata={}] File metadata
   * @param {Object} [options={}] Options
   * @return {Promise<File>} A file entity.
   */
  upload(file, metadata = {}, options = {}) {
    // Set defaults for metadata
    metadata = assign({
      filename: file._filename || file.name,
      public: false,
      size: file.size || file.length,
      mimeType: file.mimeType || file.type || 'application/octet-stream'
    }, metadata);
    metadata._filename = metadata.filename;
    delete metadata.filename;
    metadata._public = metadata.public;
    delete metadata.public;

    // Create the file on Kinvey
    const request = new KinveyRequest({
      method: RequestMethod.POST,
      authType: AuthType.Default,
      url: url.format({
        protocol: this.client.apiProtocol,
        host: this.client.apiHost,
        pathname: this.pathname
      }),
      properties: options.properties,
      timeout: options.timeout,
      body: metadata,
      client: this.client
    });
    request.headers.set('X-Kinvey-Content-Type', metadata.mimeType);

    // If the file metadata contains an _id then
    // update the file
    if (metadata._id) {
      request.method = RequestMethod.PUT;
      request.url = url.format({
        protocol: this.client.apiProtocol,
        host: this.client.apiHost,
        pathname: `${this.pathname}/${metadata._id}`
      });
    }

    // Execute the request
    return request.execute()
      .then(response => response.data)
      .then((data) => {
        const uploadUrl = data._uploadURL;
        const headers = new Headers(data._requiredHeaders);
        headers.set('content-type', metadata.mimeType);

        // Delete fields from the response
        delete data._expiresAt;
        delete data._requiredHeaders;
        delete data._uploadURL;

        // Execute the status check request
        const statusCheckRequest = new NetworkRequest({
          method: RequestMethod.PUT,
          url: uploadUrl,
          timeout: options.timeout
        });
        statusCheckRequest.headers.addAll(headers.toPlainObject());
        statusCheckRequest.headers.set('Content-Range', `bytes */${metadata.size}`);
        console.log(statusCheckRequest);
        return statusCheckRequest.execute(true)
          .then((statusCheckResponse) => {
            Log.debug('File upload status check response', statusCheckResponse);

            if (statusCheckResponse.isSuccess() === false) {
              throw statusCheckResponse.error;
            }

            if (statusCheckResponse.statusCode !== 308) {
              return file;
            }

            // Upload the file
            options.start = getStartIndex(statusCheckResponse.headers.get('range'), metadata.size);
            return this.uploadToGCS(uploadUrl, headers, file, metadata, options);
          })
          .then((file) => {
            data._data = file;
            return data;
          });
      });
  }

  /**
   * @private
   */
  uploadToGCS(uploadUrl, headers, file, metadata, options = {}) {
    // Set default options
    options = assign({
      count: 0,
      start: 0,
      maxBackoff: 32 * 1000
    }, options);

    Log.debug('Start file upload');
    Log.debug('File upload upload url', uploadUrl);
    Log.debug('File upload headers', headers.toPlainObject());
    Log.debug('File upload file', file);
    Log.debug('File upload metadata', metadata);
    Log.debug('File upload options', options);

    // Execute the file upload request
    const request = new NetworkRequest({
      method: RequestMethod.PUT,
      url: uploadUrl,
      body: isFunction(file.slice) ? file.slice(options.start) : file,
      timeout: options.timeout
    });
    request.headers.addAll(headers.toPlainObject());
    request.headers.set('Content-Range', `bytes ${options.start}-${metadata.size - 1}/${metadata.size}`);
    return request.execute(true)
      .then((response) => {
        Log.debug('File upload response', response);

        // Check if we should try uploading the remaining
        // portion of the file
        if (response.statusCode === 308) {
          Log.debug('File upload was incomplete.'
            + ' The server responded with a status code 308.'
            + ' Trying to upload the remaining portion of the file.');
          options.start = getStartIndex(response.headers.get('range'), metadata.size);
          return this.uploadToGCS(uploadUrl, headers, file, metadata, options);
        } else if (response.statusCode >= 500 && response.statusCode < 600) {
          Log.debug('File upload error.', response.statusCode, response.data);

          // Calculate the exponential backoff
          const backoff = (2 ** options.count) + randomInt(1000, 1);

          // Throw the error if we have excedded the max backoff
          if (backoff >= options.maxBackoff) {
            throw response.error;
          }

          Log.debug(`File upload will try again in ${backoff} seconds.`);


          // Upload the remaining protion of the file after the backoff time has passed
          return new Promise((resolve) => {
            setTimeout(() => {
              options.count += 1;
              resolve(this.uploadToGCS(uploadUrl, headers, file, metadata, options));
            }, backoff);
          });
        } else if (response.isSuccess() === false) {
          throw response.error;
        }

        // Return the file because we are all done
        return file;
      });
  }

  /**
   * @private
   */
  create(file, metadata, options) {
    return this.upload(file, metadata, options);
  }

  /**
   * @private
   */
  update(file, metadata, options) {
    return this.upload(file, metadata, options);
  }

  /**
   * @private
   */
  remove() {
    throw new KinveyError('Please use removeById() to remove files one by one.');
  }
}
