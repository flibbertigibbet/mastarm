import fetch from 'isomorphic-fetch'
import isObject from 'lodash.isobject'
import {createAction} from 'redux-actions'

export const INCREMENT_FETCH = 'increment outstanding fetches'
export const DECREMENT_FETCH = 'decrement outstanding fetches'
export const FETCH = 'fetch'
export const FETCH_ERROR = 'fetch error'

const incrementFetches = createAction(INCREMENT_FETCH)
const decrementFetches = createAction(DECREMENT_FETCH)
const fetchError = createAction(FETCH_ERROR)
const fetchAction = createAction(FETCH)

export function middleware (store) {
  return (next) => (action) =>
    action.type === FETCH
      ? runFetch(action.payload, store.getState())
      : next(action)
}

export default function createFetch ({
  next,
  options = {},
  url
}) {
  return [
    incrementFetches(),
    fetchAction({url, options, next})
  ]
}

function runFetch ({
  next,
  options,
  url
}, state) {
  const isJSON = isObject(options.body)
  return fetch(url, {
    ...options,
    body: isJSON ? JSON.stringify(options.body) : options.body,
    headers: {
      ...createAuthorizationHeader(state),
      ...createContentHeader(isJSON),
      ...(options.headers || {})
    }
  })
    .then(checkStatus)
    .then(createResponse)
    .then((response) => [decrementFetches(), next(response)])
    .catch((error) =>
      createErrorResponse(error)
        .then((response) => [decrementFetches(), fetchError(response), next(response, true)]))
}

function createAuthorizationHeader (state) {
  return state.user && state.user.idToken
    ? {Authorization: `bearer ${state.user.idToken}`}
    : {}
}

function checkStatus (res) {
  if (res.status >= 200 && res.status < 300) {
    return res
  } else {
    throw res
  }
}

function createContentHeader (isJSON) {
  return isJSON
    ? {'Accept': 'application/json', 'Content-Type': 'application/json;charset=UTF-8'}
    : {}
}

function createErrorResponse (res) {
  return res.headers
    ? createResponse(res)
    : Promise.resolve(res)
}

async function createResponse (res) {
  return deserialize(res).then((value) => ({
    url: res.url,
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    value
  }), (err) => {
    return {
      value: err
    }
  })
}

function deserialize (res) {
  const header = res.headers.get('Content-Type') || ''
  if (header.indexOf('application/json') > -1) return res.json()
  if (header.indexOf('application/ld+json') > -1) return res.json()
  if (header.indexOf('application/octet-stream') > -1) return res.arrayBuffer()
  return res.text()
}