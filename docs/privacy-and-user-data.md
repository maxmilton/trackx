# Privacy And User Data

TrackX takes a privacy-first approach when it comes to capturing data

TrackX captures no personally identifiable information (PII) out-of-the-box and we encourage developers to be mindful of user data when configuring error tracking. That said, you, the developer, have the power to capture whatever additional data you need, so the flexibility is there if you need it.

TODO: Write me:

- Everything mentioned here is about the out-of-the-box experience. TrackX provides simple but powerful ways to extend our error tracking client to collect whatever extra data you need.
- We believe data privacy should be the default

- No cookies or persistent local storage
- No personally identifiable information (PII) about users is stored, either in the client or in the API database
  - IP and user-agent header data is captured, used in-memory, and then discarded (never stored in the database!)
  - Save basic browser and os info and then discard the full user-agent string
- Explicitly state what data the `trackx` client does collect
- Explain how session tracking works
  - (pseudocode): `hash(daily_salt + request_origin + ip_address + user_agent)`
  - Daily rotating salt (changes at midnight UTC)
    - Old hashes are deleted
  - Something like <https://plausible.io/data-policy>
- Flow diagram or something like <https://usefathom.com/data>
- Explain what a hash and salt is
  - <https://usefathom.com/blog/anonymization>
  - <https://usefathom.com/docs/troubleshooting/hashes-salts>
- GDPR and other user privacy law
  - Is TrackX except?
  - Should also note I'm not a lawyer; seek your own lawyer for council if you're concerned
- Fully open source with a permissive license
  - Anyone can review the code and submit changes or feedback
- Is it worth noting it's an open source project, not a service, so no policies or guaranties? It's a negative point but I'd rather not be legally responsible... or is the MIT license clear enough?
- What potential PII may collected? — although TrackX doesn't explicitly capture PII, it's up to the user to use responsible error messages etc.
  - URLs; `location.href` of the page which threw the error + URLs in stack traces
  - Error name, message, and stack trace (up to the user)
- The `trackx` client takes an optional callback function that's run just before an event is sent that can modify the payload or even prevent sending the event altogether. Can be used for PII data scrubbing.
- While we're still in early development browser report events may contain PII
- What about Node.js, Deno, or other non-browser environments?
  - In the node client we generate a simple user-agent and the user may set a custom origin
- Services stack on top of TrackX — Docker, Nginx, etc. — may log PII data such as IP address but it's not persistently stored by default. If you choose to store these logs, it's recommended to anonymize the data before writing to disk or forwarding to another service.
- There's no way to track users, that is, it's not possible to attribute a specific user across session hashes; even if we know a part of the hash like IP, there's no way to reverse the hash based on that knowledge

- No cookies or other persistent identifiers
- No personal data is collected and all stats are in aggregate only
- No cross-site or cross-device tracking
- Fully open source web analytics software that can be self-hosted

## How are sessions calculated?

**tl;dr** No cookies or other client storage mechanisms are used. Sessions are identified on the backend with `hash(daily_salt + request_origin + ip_address + user_agent)`. Regardless of how many times a user hits your website or app, it only counts as one session per unique hash e.g., one per day.

---

The number of sessions you see might not be what you expect. In TrackX sessions are identified in a privacy-friendly way and so the numbers are likely to be different from other error reporting or web statistics services (unless you're already using privacy focussed analytics like [Plausible](https://plausible.io) or [Fathom](https://usefathom.com)).

TODO: Write me

<!--
TODO: Add expandable section here with an example of the hash construction with realistic inputs

```
XXH3 (
  "Zpko0dtl" +
  "https://docs.trackx.app" +
  "132.250.17.201" +
  "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36"
)
```

```sh
echo -n 'Zpko0dtlhttps://docs.trackx.app132.250.17.201Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' | xxhsum -H3 -

# XXH3 (stdin) = 4a2d74a7cc34df38
```
-->

- No cookies or other client-side storage mechanisms to identify users
- Users are identified on the backend using hash of `salt`+`origin`+`ip`+`user-agent`
- Error-free sessions are only tracked when you use the optional "ping" feature

## Data flow

1. A user accesses your website or your app is run.
1. Your code calls `trackx.setup()` which adds instrumentation to detect errors.  
   — see [packages/trackx/src/\*](https://github.com/maxmilton/trackx/tree/master/packages/trackx/src)
1. If you're using the `trackx.ping()` feature, a ping request is sent to the backend.
   1. If the ping request is valid, a hash is generated to uniquely identify the session and if it's a new hash, we save a new session in the database. The user's IP address and user-agent are used to create the hash but then discarded (only the hash is saved in the database).  
      — see [packages/trackx-api/src/routes/v1/[key]/ping.ts](https://github.com/maxmilton/trackx/blob/master/packages/trackx-api/src/routes/v1/%5Bkey%5D/report.ts)
1. Users use the application (with minimal overhead from the `trackx` client)
1. At this point one of 2 things can happen:
   1. When an error is encountered or your code programatically calls `trackx.sendEvent()`, data about the error is captured and an event may be sent
      1. If the client has an `OnErrorHandler`, the function is called allowing the event payload to be modified as necessary or stop the request from being sent — see [packages/trackx/types.ts#63](https://github.com/maxmilton/trackx/blob/master/packages/trackx/types.ts#L63)`
      1. If the event request is valid, it's processed, analysed and grouped into an existing matching issue or else a new issue is created — see [packages/trackx-api/src/routes/v1/[key]/event.ts](https://github.com/maxmilton/trackx/blob/master/packages/trackx-api/src/routes/v1/%5Bkey%5D/event.ts)
      1. Event requests will also create a session if one doesn't exist (similar to 3.a) or if a session does exist it's marked as having an error.
   1. If you're using the browser reports feature, when a user's browser encounters an issue it may automatically send a report
      1. The report request is processed, analysed, and grouped into an existing matching issue or else a new issue is created — see [packages/trackx-api/src/routes/v1/[key]/report.ts](https://github.com/maxmilton/trackx/blob/master/packages/trackx-api/src/routes/v1/%5Bkey%5D/report.ts)
      1. Report requests will also create a session if one doesn't exist (similar to 3.a) or if a session does exist it's marked as having an error.
