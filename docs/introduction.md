<div style="margin:3rem 0;text-align:center">
  <img src="favicon.svg" style="width:9rem">
  <div style="margin-top:1.1rem;font-size:3.5rem;font-weight:300;letter-spacing:2px">TrackX</div>
  <div style="margin-top:0.5rem;font-size:1.5rem;color:#ff66a1">Simple, lightweight, and privacy-friendly error tracking.</div>
  <div style="margin-top:2.5rem">
    <a href="#/getting-started/installation.md" class="button">Get Started</a>
    <a href="https://demo.trackx.app" class="button" style="margin-left:.5rem" target="_bank">View Demo</a>
  </div>
</div>

# Introduction

TODO: Write me:

- Technical design goals:
  - Small JS client size — <https://cdn.jsdelivr.net/npm/trackx/>
  - Good client cross-browser compatibility + Node.js + Deno + other non-browser JS environments
  - Self-hosted
    - Low system requirements (so much so that the backend can run on a free GCE or AWS compute VM for even the most modest throughput TrackX instance, tens of millions of events per month)
  - Real-time data dashboards in the frontend
  - Privacy first
    - Essential data only by default, while still giving developers the flexibility to add any data point
    - No personal data collected
    - All data in aggregate only

## Repo structure

![Visualization of this repo](./assets/repo-structure-diagram.svg)
