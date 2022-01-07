import { routeTo } from '@maxmilton/solid-router';
import { IconAlert, IconChevronRight } from '@trackx/icons';
import { createEffect, createResource, type Component } from 'solid-js';
import { createStore } from 'solid-js/store';
import { For, Match, Switch } from 'solid-js/web';
import type { Logs } from '../../../trackx-api/src/types';
import { renderErrorAlert } from '../components/ErrorAlert';
import { Loading } from '../components/Loading';
import {
  AppError, config, fetchJSON, logout,
} from '../utils';
import './logs.xcss';

export async function goToIssue(event: MouseEvent, eventId: number) {
  try {
    const res = await fetch(
      `${config.DASH_API_ENDPOINT}/logs?type=issue-from-event`,
      {
        method: 'POST',
        credentials: 'same-origin',
        mode: 'same-origin',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      },
    );
    const text = await res.text();

    if (!res.ok) {
      if (res.status === 401) {
        void logout();
        return;
      }

      throw new AppError(text, res.status);
    }

    const url = `/issues/${text}?event=${eventId}`;

    if (event.ctrlKey || event.shiftKey) {
      window.open(url);
    } else {
      await routeTo(url);
    }
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

interface GoToIssueLinkProps {
  eventId: string;
}

const GoToIssueLink: Component<GoToIssueLinkProps> = (props) => (
  <button
    type="button"
    class="button-link"
    onClick={(event) => goToIssue(event, +props.eventId)}
    textContent={props.eventId}
  />
);

interface PaginatedTableProps {
  headers: string[];
  rows: (string | number)[][];

  // TODO: Remove
  isEventList?: boolean;
}

const PaginatedTable: Component<PaginatedTableProps> = (props) => {
  const [state, setState] = createStore({
    offset: 0,
    size: 10,
    get list(): typeof props.rows {
      // const start = this.offset * this.size || 0;
      // return props.rows.slice(start || 0, start + this.size);

      // TODO: Remove once no longer necessary; switch back to above
      const start = this.offset * this.size || 0;
      let rows = props.rows.slice(start || 0, start + this.size);

      if (props.isEventList) {
        rows = rows.map((row) => {
          const newRow = [...row];
          // @ts-expect-error - temp
          newRow[0] = <GoToIssueLink eventId={row[0]} />;
          return newRow;
        });
      }

      return rows;
    },
    get disablePrev(): boolean {
      return this.offset < 1;
    },
    get disableNext(): boolean {
      return this.offset * this.size + this.size >= props.rows.length;
    },
  });

  return (
    <div class="paginated-table-wrapper mh-3 ns-mh0">
      <nav class="paginated-table-nav dfc pa2">
        <div class="button-group mr3">
          <button
            class="button flip-icon"
            disabled={state.disablePrev}
            title="Previous results"
            onClick={() => {
              setState({ offset: state.offset - 1 });
            }}
          >
            <IconChevronRight />
          </button>
          <button
            class="button"
            disabled={state.disableNext}
            title="Next results"
            onClick={() => {
              setState({ offset: state.offset + 1 });
            }}
          >
            <IconChevronRight />
          </button>
        </div>
        <div>
          {props.rows.length > state.size
            && `${state.offset * state.size + 1} to ${
              state.offset * state.size + state.list.length
            } of `}
          {props.rows.length.toLocaleString()} row
          {props.rows.length === 1 ? '' : 's'}
        </div>
        <div class="ml-auto">
          <label htmlFor="size" class="label dn ns-dib mr2 muted">
            Show
          </label>
          <select
            id="size"
            class="select"
            value={state.size}
            onInput={(event) => {
              setState({
                offset: 0,
                size: +event.currentTarget.value,
              });
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="100">100</option>
            <option value="Infinity">All</option>
          </select>
        </div>
      </nav>

      <div class="table-wrapper pa2">
        <table class="paginated-table table tnum">
          <thead>
            <tr>
              {props.headers.map((header) => (
                <th textContent={header} />
              ))}
            </tr>
          </thead>
          <tbody>
            <For
              each={state.list}
              fallback={
                <tr>
                  <td>No data</td>
                </tr>
              }
            >
              {(row) => (
                <tr>
                  {row.map((item) => (
                    // TODO: Enforce rendered as text once we no longer need link
                    // <td textContent={item} />
                    <td>{item}</td>
                  ))}
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Get percentile using "linear interpolation between closest ranks" method.
 *
 * @param arr - **Sorted** numeric array.
 * @param p - Percentile; a decimal value between 0 and 1.
 */
// https://gist.github.com/IceCreamYou/6ffa1b18c4c8f6aeaad2
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  if (p <= 0) return arr[0];
  if (p >= 1) return arr[arr.length - 1];

  const index = (arr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = lower + 1;
  const weight = index % 1;

  if (upper >= arr.length) return arr[lower];
  return arr[lower] * (1 - weight) + arr[upper] * weight;
}

// Similar to num.toFixed(2) but without rounding
function trimNumber(num: number): number {
  return Math.trunc(num * 100) / 100;
}

function toBytes(size: string): number {
  let n = Number.parseFloat(size);

  if (Number.isNaN(n)) return -1;

  if (size.slice(-2) !== ' B') {
    switch (size.slice(-3)) {
      case 'KiB':
        n *= 1024;
        break;
      case 'MiB':
        n *= 1024 * 1024;
        break;
      default:
        n = -1;
        break;
    }
  }

  return n;
}

function toNumber(input: string): number {
  const n = Number.parseFloat(input);
  return Number.isNaN(n) ? -1 : n;
}

const LogsPage: Component = () => {
  const [logs, { mutate }] = createResource<Logs, string>(
    `${config.DASH_API_ENDPOINT}/logs`,
    fetchJSON,
  );

  createEffect(() => {
    document.title = 'Logs | TrackX';
  });

  return (
    <div class="con">
      <h1>Logs</h1>

      <Switch fallback={<p class="danger">Failed to load logs</p>}>
        <Match when={logs.error} children={renderErrorAlert} />
        <Match when={logs.loading}>
          <Loading />
        </Match>
        <Match when={logs()}>
          <>
            <h2>Denied Event Requests</h2>
            <div class="table-denied-event">
              <PaginatedTable
                headers={['Date', 'Project Key', '#']}
                rows={logs()!.denied_event}
              />
            </div>

            <h2>Denied Ping Requests</h2>
            <div class="table-denied-ping">
              <PaginatedTable
                headers={['Date', 'Project Key', '#']}
                rows={logs()!.denied_ping}
              />
            </div>

            <h2>Denied Dash Requests</h2>
            <div class="table-denied-dash">
              <PaginatedTable
                headers={['Date', '#']}
                rows={logs()!.denied_dash}
              />
            </div>

            {/* FIXME: Remove; temp for development of event ingest pipeline */}
            <h2>Event Ingest Performance</h2>

            <div class="alert alert-warning df">
              <span class="mr2">
                <IconAlert />
              </span>
              Temporary data for event ingest pipeline development.
            </div>

            <div class="df aib">
              <label htmlFor="perf-event-sort" class="label dib mr2 muted">
                Sort by
              </label>
              <select
                id="perf-event-sort"
                class="select"
                onInput={(event) => {
                  const column = +event.currentTarget.value;

                  mutate((prev) => ({
                    ...prev!,
                    perf_event: prev!.perf_event.sort(
                      column === 4
                        ? (a, b) => toBytes(b[column]) - toBytes(a[column])
                        : (a, b) => toNumber(b[column]) - toNumber(a[column]),
                    ),
                  }));
                }}
              >
                <option value="0">Event ID</option>
                <option value="1">Total (ms)</option>
                <option value="2">Raw (ms)</option>
                <option value="3">Enhance (ms)</option>
                <option value="4">Size (bytes)</option>
                <option value="5">Frames</option>
              </select>

              <button
                class="button dn ns-db ml-auto"
                onClick={() => {
                  // eslint-disable-next-line unicorn/consistent-function-scoping
                  const sorter = (a: number, b: number) => a - b;

                  const events = logs()!.perf_event;
                  const d1 = events.map((row) => toNumber(row[1])).sort(sorter);
                  const d2 = events.map((row) => toNumber(row[2])).sort(sorter);
                  const d3 = events.map((row) => toNumber(row[3])).sort(sorter);
                  const d4 = events.map((row) => toBytes(row[4])).sort(sorter);
                  const d5 = events.map((row) => toNumber(row[5])).sort(sorter);

                  const getResults = (p: number) => ({
                    total: trimNumber(percentile(d1, p)),
                    raw: trimNumber(percentile(d2, p)),
                    enhance: trimNumber(percentile(d3, p)),
                    size: trimNumber(percentile(d4, p)),
                    frames: trimNumber(percentile(d5, p)),
                  });

                  // eslint-disable-next-line no-console
                  console.table({
                    min: getResults(0),
                    p75: getResults(0.75),
                    p95: getResults(0.95),
                    p98: getResults(0.98),
                    p99: getResults(0.99),
                    max: getResults(1),
                  });
                }}
              >
                Log percentiles (to console)
              </button>
            </div>

            <div class="table-perf-event mt2">
              <PaginatedTable
                headers={['Event', 'Total', 'Raw', 'Enhance', 'Size', 'Frames']}
                rows={logs()!.perf_event}
                isEventList
              />
            </div>
          </>
        </Match>
      </Switch>
    </div>
  );
};

export default LogsPage;
