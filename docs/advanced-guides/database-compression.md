# Database Compression

SQLite does not support data compression out of the box. TrackX adds compression support by utilising the `sqlite-zstd` SQLite extension (<https://github.com/phiresky/sqlite-zstd>).

`sqlite-zstd` works by using [Zstandard](https://facebook.github.io/zstd/) to compress the data within a _single column_ of a table, at a per-row level. Data is compressed when a row is written to and decompressed when read, that is, compression is transparent and no additional changes need to be made to queries (however there some caveats listed below).

Zstandard is particularly interesting in our use case because of its [dictionary compression](https://facebook.github.io/zstd/#small-data) feature, which sqlite-zstd supports. It makes it possible to generate a dictionary custom to your specific data so you can get good compression ratios even when your individual event data is small.

## Should I use compression?

The event table can grow to be very large, especially if you have a lot of events and/or if the individual event data size is large. There are two scenarios in particular where enabling compression would be more beneficial:

1. To reduce the database size on disk. This is the most obvious case, however, keep in mind disk space is cheap so it's rare you would need to optimise for disk size. Without compression, even with tens of millions of sessions, issues, and events the size on disk should be around 5–20 gigabytes (subject to the size of your event data). In a typical instance expect size on disk to be less than 1 gigabyte.

1. ~~To improve read performance when average individual event data is large.~~ — no longer the case after an issue page event pagination refactor; there shouldn't be any DB queries which do an event table scan anymore!

## Caveats

- Because `sqlite-zstd` only compresses a single column within a single table, compression is not across the entire database but only on the `event` table's `data` column. In a typical TrackX instance, this one column is up to 90% of the overall database size (without compression).
- Since additional work happens on `event` table `data` column reads and writes, these operations add a small CPU and memory overhead. In most cases the impact is negligible but if you're running on very restrictive hardware (e.g., a Raspberry Pi) and have high event throughput plus large event data sizes or you set the compression level very high, it may be something to look out for.
- TODO: Explain the point of a minimum dictionary size.
- TODO: Explain the `event` table becomes a view and the real backing table will be `_event_zstd` + `INSERT`s on `event` will _not_ have `run().lastInsertRowid`/`last_insert_rowid()`/`RETURNING id` available.
- TODO: Explain each row compression is against a referenced dictionary so it's possible for different rows to be compressed against different dictionaries. Not so much a caveat as something to be aware of, especially once we have better CLI tooling e.g., to create a new dictionary. Also add documentation about the advanced case of recompressing all the data with a new dictionary.
- TODO: Explain reverting compression; going back to raw uncompressed data.
  - See `packages/trackx-api/migrations/___revert-compression.sql`

## How to enable compression

TODO: Implement a more admin user friendly flow and CLI tooling + update steps here.

> **Note:** This should work on both a new or existing TrackX instance. If you run into any problems please open an [issue on GitHub](https://github.com/maxmilton/trackx/issues).

1. Download the [latest sqlite-zstd release](https://github.com/phiresky/sqlite-zstd/releases) for your CPU architecture.
1. Extract the file to the `packages/trackx-api` directory.
1. Edit your API configuration (typically `trackx.config.js`). Change `DB_COMPRESSION` to a valid value other than `0` and check `DB_ZSTD_PATH` has the correct file name.
1. Follow the [installation guide](#/getting-started/installation.md) to deploy a build to your server.
1. Run the CLI tool; `trackx install -f` or `node cli.js install -f`.
