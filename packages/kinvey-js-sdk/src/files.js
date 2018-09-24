import isNumber from 'lodash/isNumber';
import isFunction from 'lodash/isFunction';
import {
  execute,
  formatKinveyBaasUrl,
  Request,
  KinveyRequest,
  RequestMethod,
  Auth,
  Headers
} from './http';
import Query from './query';

const NAMESPACE = 'blob';
const MAX_BACKOFF = 32 * 1000;

export async function downloadByUrl(url) {
  const request = new Request({
    method: RequestMethod.GET,
    url
  });
  const response = await execute(request);
  return response.data;
}

export async function find(query = new Query(), options = {}) {
  if (query && !(query instanceof Query)) {
    throw new Error('Invalid query. It must be an instance of the Query class.');
  }

  const { download = false, tls = true, ttl } = options;
  const queryStringObject = Object.assign({}, query.toQueryObject(), { tls: tls === true });

  if (isNumber(ttl)) {
    queryStringObject.ttl_in_seconds = parseInt(ttl, 10);
  }

  const request = new KinveyRequest({
    method: RequestMethod.GET,
    auth: Auth.Default,
    url: formatKinveyBaasUrl(`/${NAMESPACE}/appKey`, queryStringObject)
  });
  const response = await execute(request);
  const files = response.data;

  if (download === true) {
    return Promise.all(files.map(file => downloadByUrl(file._downloadURL, options)));
  }

  return files;
}

export async function download(id) {

}

export async function findById(id, options) {
  return download(id, options);
}

export async function stream(id, options = {}) {
  return download(id, Object.assign(options, { stream: true }));
}

function transformMetadata(file = {}, metadata = {}) {
  const fileMetadata = Object.assign({
    filename: file._filename || file.name,
    public: false,
    size: file.size || file.length,
    mimeType: file.mimeType || file.type || 'application/octet-stream'
  }, metadata);
  fileMetadata._filename = metadata.filename;
  delete fileMetadata.filename;
  fileMetadata._public = metadata.public;
  delete fileMetadata.public;
  return fileMetadata;
}

async function saveFileMetadata(metadata, options = {}) {
  if (metadata.size <= 0) {
    throw new Error('Unable to create a file with a size of 0.');
  }

  const request = new KinveyRequest({
    method: metadata._id ? RequestMethod.PUT : RequestMethod.POST,
    auth: Auth.Default,
    headers: {
      'X-Kinvey-Content-Type': metadata.mimeType
    },
    url: metadata._id ? formatKinveyBaasUrl(`/${NAMESPACE}/appKey/${metadata._id}`) : formatKinveyBaasUrl(`/${NAMESPACE}/appKey`),
    body: metadata
  });
  const response = await execute(request);
  return response.data;
}

function checkUploadStatus(url, headers, metadata, timeout) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Content-Type', metadata.mimeType);
  requestHeaders.set('Content-Range', `bytes */${metadata.size}`);
  const request = new Request({
    method: RequestMethod.PUT,
    headers: requestHeaders,
    url,
    timeout
  });
  return execute(request);
}

function getStartIndex(rangeHeader, max) {
  const start = rangeHeader ? parseInt(rangeHeader.split('-')[1], 10) + 1 : 0;
  return start >= max ? max - 1 : start;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

async function uploadFile(url, file, metadata, options) {
  const { count = 0, maxBackoff = MAX_BACKOFF } = options;
  let { start = 0 } = options;

  const requestHeaders = new Headers(options.headers);
  requestHeaders.set('Content-Type', metadata.mimeType);
  requestHeaders.set('Content-Range', `bytes ${options.start}-${metadata.size - 1}/${metadata.size}`);
  const request = new Request({
    method: RequestMethod.PUT,
    headers: requestHeaders,
    url,
    body: isFunction(file.slice) ? file.slice(options.start) : file,
    timeout: options.timeout
  });
  const response = await execute(request);

  if (!response.isSuccess()) {
    throw response.error;
  }

  let backoff = 0;

  // We should retry uploading the file
  if (response.isServerError()) {
    backoff = (2 ** options.count) + randomInt(1, 1001); // Calculate the exponential backoff

    if (backoff >= options.maxBackoff) {
      throw response.error;
    }

    setTimeout(() => {
      uploadFile(url, file, metadata, { count: count + 1, start, maxBackoff });
    }, backoff);
  }

  // The upload isn't complete and we must upload the rest of the file
  if (response.statusCode === 308) {
    start = getStartIndex(response.headers.get('range'), metadata.size);
    setTimeout(() => {
      uploadFile(url, file, metadata, { count: 0, start, maxBackoff });
    }, backoff);
  }

  return response.data;
}

export async function upload(file = {}, metadata = {}, options = {}) {
  const fileMetadata = transformMetadata(file, metadata);
  const kinveyFile = await saveFileMetadata(fileMetadata, options);
  const uploadStatusResponse = await checkUploadStatus(kinveyFile._uploadURL, kinveyFile._requiredHeaders, fileMetadata, options.timeout);

  if (!uploadStatusResponse.isSuccess()) {
    throw uploadStatusResponse.error;
  }

  if (uploadStatusResponse.statusCode !== 200 && uploadStatusResponse.statusCode !== 201) {
    if (uploadStatusResponse.statusCode !== 308) {
      // TODO: Here we should handle redirects according to location header, but this generally shouldn't happen
      throw new Error('Unexpected response for upload file status check request.');
    }

    const uploadOptions = {
      start: getStartIndex(uploadStatusResponse.headers.get('range'), metadata.size),
      timeout: options.timeout,
      maxBackoff: options.maxBackoff,
      headers: kinveyFile._requiredHeaders
    };
    await uploadFile(kinveyFile._uploadURL, file, fileMetadata, uploadOptions);
  }

  delete kinveyFile._expiresAt;
  delete kinveyFile._requiredHeaders;
  delete kinveyFile._uploadURL;
  // kinveyFileData._data = file;
  return kinveyFile;
}

export async function create(file, metadata, options) {
  return upload(file, metadata, options);
}

export async function update(file, metadata, options) {
  return upload(file, metadata, options);
}

export async function remove() {
  throw new Error('Please use removeById() to remove files one by one.');
}

export async function removeById(id) {
  const request = new KinveyRequest({
    method: RequestMethod.DELETE,
    auth: Auth.Default,
    url: formatKinveyBaasUrl(`/${NAMESPACE}/appKey/${id}`)
  });
  const response = await execute(request);
  return response.data;
}
