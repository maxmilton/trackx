# Event API

Notes:

- While TrackX is in alpha/beta there may be breaking changes to the public API
- REST API with versioned endpoints
- `[key]` means project key
- `/dash/*` API is private and not designed for programmatic use

Table of contents:

- [`/v1/[key]/event`](#v1keyevent)
- [`/v1/[key]/ping`](#v1keyping)
- [`/v1/[key]/report`](#v1keyreport)

## Endpoints

### `/v1/[key]/event`

Error event capture.

Method: `POST`  
Headers: `Origin` and `User-Agent` required  
Query Parameters: None allowed

Example body payload:

```json
{
  "name": "Error",
  "message": "Test error",
  "stack": "TestPage/_el$12.$$click@https://example.com/test.js:350:13\neventHandler@https://example.com/runtime.js:1176:47\nEventListener.handleEvent*delegateEvents@https://example.com/runtime.js:1043:16\n@https://example.com/runtime.js:1748:15\n",
  "type": 1,
  "uri": "https://example.com/test",
  "meta": {
    "_c": "_",
    "_v": "1.0.0",
    "release": "v1.2.3",
    "example": true
  }
}
```

#### Body Parameters

For more details see the [`trackx` client TypeScript types](https://github.com/maxmilton/trackx/blob/master/packages/trackx/types.ts).

##### `name` (Optional)

Type: `string`

Error name.

##### `message`

Type: `string`

Error message.

##### `stack` (Optional)

Type: `string`

JavaScript Error stack trace.

##### `type`

Type: `number` (corresponding to the `EventType` enum)

##### `uri` (Optional)

Type: `string`

URL of the browser web page where the error occurred. For non-browser environments you can use any identifier to mark the location of the error. Although this value is not validated to enforce a particular form, we encourage you to use URI syntax for consistency and readability.

##### `meta` (Optional)

Type: `Record<string, any>`

Must be JSON serialisable. Meta properties beginning with an underscore should not be use as they're reserved for internal use.

### `/v1/[key]/ping`

Session ping capture. Events captured via `/event` and `/report` generate a session and mark it as "with error". To also track error-free sessions, send a request to `/ping` to register a session.

Method: `GET` or `POST`  
Headers: `Origin` and `User-Agent` required  
Query Parameters: None allowed  
Body Properties: None allowed

- Calling `/ping` multiple times is OK. Sessions are [uniquely identified on the backend using a hash](/privacy-and-user-data.md#how-are-sessions-calculated) so multiple pings will not create multiple sessions.
- If the `Accept` header includes "image" a white 1x1 pixel GIF image is send in response. This makes it possible to do:

  ```js
  new Image().src = API_ENDPOINT + '/ping';
  ```

### `/v1/[key]/report`

Browser report capture.

Method: `POST`  
Headers: `Origin` and `User-Agent` required, others varies  
Query Parameters: None allowed  
Body Properties: Varies

This endpoint is a work in progress and is has not stabilised yet. The [CSP: report-uri](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri) header and [CSP: report-to](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-to) header are still in flux and the browser [Reporting API](https://developer.mozilla.org/en-US/docs/Web/API/Reporting_API) is still in draft state.
