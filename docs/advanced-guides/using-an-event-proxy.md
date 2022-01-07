# Using An Event Proxy

TODO: Write about using a proxy + provide instructions on how to set one up

- An event proxy allows you to:
  - Mutate event payloads before they hit the TrackX backend
  - Use a custom URL different from your TrackX backend
  - Route events to different backends e.g., based on environment
  - Reduce latency
    - With a CDN + accepting requests straight away can drastically improve network performance but there are challenges around rate limiting and handling malformed requests
- Providers:
  - Cloudflare workers
    - https://plausible.io/docs/proxy/guides/cloudflare
  - AWS Lambda
  - GCP Cloud Functions & Firebase Functions
  - DIY server
- Interesting things you can do
  - Conditionally add IP address to meta data
    - Sometimes for debugging the IP address is actually very helpful
    - Perhaps you want to add the IP but only for internal users, so a proxy would be ideal since you can act conditionally e.g., based on a known CIDR range
  - PII & sensitive data scrubbing
    - It's also possible in the client `OnErrorHandler` callback but a proxy may be better since you can save a lot of bytes by not shipping the code to the frontend + the scrubber itself might contain sensitive information
    - <https://developers.cloudflare.com/workers/examples/data-loss-prevention>
  - Decorate meta data
    - Add geolocation data such as country code
      - <https://developers.cloudflare.com/workers/examples/geolocation-hello-world>
  - If we ever offer a hosted version or if you're using a TrackX API instance where you don't have access to the server for whatever reason, a proxy can be used for debugging requests
