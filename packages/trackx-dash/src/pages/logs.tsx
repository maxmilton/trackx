import './logs.xcss';

import type { RouteComponent } from '@maxmilton/solid-router';
import { IconChevronRight } from '@trackx/icons';
import { createEffect, createResource, type Component } from 'solid-js';
import { createStore } from 'solid-js/store';
import { For, Match, Switch } from 'solid-js/web';
import type { Logs } from '../../../trackx-api/src/types';
import { renderErrorAlert } from '../components/ErrorAlert';
import { Loading } from '../components/Loading';
import { config, fetchJSON } from '../utils';

interface PaginatedTableProps {
  headers: string[];
  rows: (string | number)[][];
}

const PaginatedTable: Component<PaginatedTableProps> = (props) => {
  const [state, setState] = createStore({
    offset: 0,
    size: 10,
    get list(): typeof props.rows {
      const start = this.offset * this.size || 0;
      return props.rows.slice(start || 0, start + this.size);
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
          <label for="size" class="label dn ns-dib mr2 muted">
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
                    <td textContent={item} />
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

const LogsPage: RouteComponent = () => {
  const [logs] = createResource<Logs, string>(
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
        <Match when={logs.error} children={renderErrorAlert} keyed />
        <Match when={logs.loading}>
          <Loading />
        </Match>
        <Match when={logs()} keyed>
          {(logsData) => (
            <>
              <h2>Denied Event Requests</h2>
              <div class="table-denied-event">
                <PaginatedTable
                  headers={['Date', 'Project Key', '#']}
                  rows={logsData.denied_event}
                />
              </div>

              <h2>Denied Ping Requests</h2>
              <div class="table-denied-ping">
                <PaginatedTable
                  headers={['Date', 'Project Key', '#']}
                  rows={logsData.denied_ping}
                />
              </div>

              <h2>Denied Dash Requests</h2>
              <div class="table-denied-dash">
                <PaginatedTable
                  headers={['Date', '#']}
                  rows={logsData.denied_dash}
                />
              </div>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
};

export default LogsPage;
