# Tracking Errors

Interesting uses of setup() `OnErrorHandler`:

- falsely return value will prevent the event from being sent

Simple client-side event sampling rate

```js
trackx.setup(
  'https://api.trackx.app/v1/xxxxxxxxxxx/event',
  // where 0.3 represents a 30% chance the event will be sent
  (payload) => (Math.random() < 0.3 ? payload : null),
);
```
