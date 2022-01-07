# Tracking Sessions

- Sessions are automatically created for every error event and browser report event
  - These events are marked as "with event" so we know there was some kind of exception
- Error-free sessions mean there was no events during the session
- Send a ping to register a session
  ```js
  trackx.ping();
  ```
- Sending multiple pings is fine, sessions are uniquely identified on the backend
  - See [how sessions are calculated](/privacy-and-user-data.md#how-are-sessions-calculated)
