import './stats.xcss';

import type { RouteComponent } from '@maxmilton/solid-router';
import reltime from '@trackx/reltime';
import {
  createEffect,
  createResource,
  createSignal,
  type Component,
} from 'solid-js';
import { For, Match, Switch } from 'solid-js/web';
import UPlot from 'uplot';
import type {
  DBStats,
  Stats,
  TimeSeriesData,
} from '../../../trackx-api/src/types';
import { renderErrorAlert } from '../components/ErrorAlert';
import { Graph } from '../components/Graph';
import { Loading } from '../components/Loading';
import { config, fetchJSON } from '../utils';

interface DailyGraphProps {
  data: TimeSeriesData;
  label: string;
}

const graphSync = UPlot.sync('stats');

// TODO: These graphs should have lighter coloured background opts.axes[0&1].grid.stroke
const DailyGraph: Component<DailyGraphProps> = (props) => (
  <Graph
    data={props.data}
    opts={{
      height: 200,
      cursor: {
        sync: {
          key: graphSync.key,
          setSeries: true,
        },
      },
      series: [
        {},
        {
          label: props.label,
          width: 2,
          stroke: '#f29d49', // orange4
          fill: '#d9822b1a', // orange3 + 0.1 alpha
          paths: UPlot.paths.linear!(),
          points: {
            show: false,
          },
        },
        {
          label: 'Denied',
          width: 2,
          stroke: '#f55656', // red4
          paths: UPlot.paths.points!(),
          spanGaps: false,
          points: {
            show: true,
            width: 0,
          },
        },
      ],
    }}
  />
);

const StatsPage: RouteComponent = () => {
  const [stats] = createResource<Stats, string>(
    () => `${config.DASH_API_ENDPOINT}/stats`,
    fetchJSON,
  );
  const [dbStatsURL, setDBStatsURL] = /* @__PURE__ */ createSignal<string>();
  const [dbStats] = /* @__PURE__ */ createResource<DBStats, string>(
    dbStatsURL,
    fetchJSON,
  );

  createEffect(() => {
    document.title = 'Stats | TrackX';
  });

  return (
    <div class="con">
      <h1>Stats</h1>

      <Switch fallback={<p class="danger">Failed to load stats</p>}>
        <Match when={stats.error} children={renderErrorAlert} keyed />
        <Match when={stats.loading}>
          <Loading />
        </Match>
        <Match when={stats()} keyed>
          {(data) => (
            <div class="df f-col ns-f-row">
              <div class="m-mr4 l-mr5">
                <h2>Platform</h2>

                <p>{data.event_c.toLocaleString()} events</p>
                <p>
                  {data.issue_c.toLocaleString()} issues{' '}
                  <span class="muted">(</span>
                  {(
                    data.issue_c
                    - (data.issue_done_c + data.issue_ignore_c)
                  ).toLocaleString()}{' '}
                  open, {data.issue_done_c.toLocaleString()} resolved,{' '}
                  {data.issue_ignore_c.toLocaleString()} ignored
                  <span class="muted">)</span>
                </p>
                <p>
                  {data.session_c.toLocaleString()} sessions{' '}
                  <span class="muted">(</span>
                  {data.session_e_c.toLocaleString()} with errors
                  <span class="muted">)</span>
                </p>
                <p>{data.project_c.toLocaleString()} projects</p>
                <p>
                  {data.dash_session_c.toLocaleString()} active dash session
                  {data.dash_session_c === 1 ? '' : 's'}
                </p>

                <hr />

                <p>Dash {process.env.APP_RELEASE}</p>
                <p>API {data.api_v}</p>
                <p>
                  <span
                    aria-label={new Date(
                      Date.now() - data.api_uptime * 1000,
                    ).toLocaleString()}
                    data-tooltip
                  >
                    API uptime:{' '}
                    {reltime(Date.now() - data.api_uptime * 1000).replace(
                      'ago',
                      '',
                    )}
                  </span>
                </p>

                {process.env.ENABLE_DB_TABLE_STATS && (
                  <div>
                    <hr />
                    <h2>Database</h2>

                    {/* TODO: Consider moving DB table stats to trackx-cli */}

                    {/* FIXME: Generating DB table stats is slow in general and
                    extremely slow on systems with slower storage devices
                      ↳ https://github.com/maxmilton/trackx/issues/158 */}

                    {!dbStatsURL() ? (
                      <>
                        <div class="alert alert-warning">
                          <strong>WARNING:</strong> Getting DB stats is slow!
                        </div>
                        <button
                          class="button"
                          onClick={() => {
                            setDBStatsURL(
                              `${config.DASH_API_ENDPOINT}/stats?type=db`,
                            );
                          }}
                        >
                          Get DB stats
                        </button>
                      </>
                    ) : (
                      <Switch
                        fallback={<p class="danger">Failed to load DB stats</p>}
                      >
                        <Match
                          when={dbStats.error}
                          children={renderErrorAlert}
                          keyed
                        />
                        <Match when={dbStats.loading}>
                          <Loading />
                        </Match>
                        <Match when={dbStats()} keyed>
                          {(data2) => (
                            <>
                              <p class="wsn">
                                {data2.db_size}
                                <span class="muted"> + </span>
                                {data2.db_size_wal}
                                <span class="muted"> (wal)</span>
                              </p>
                              <h3>Tables</h3>
                              <div class="table-wrapper">
                                <table class="table wi tr tnum">
                                  <For
                                    each={data2.db_tables}
                                    fallback="No data"
                                  >
                                    {(row) => (
                                      <tr>
                                        <td
                                          class="tl break"
                                          textContent={row.name}
                                        />
                                        <td
                                          class="wsn"
                                          textContent={row.size}
                                        />
                                        <td textContent={row.percent} />
                                      </tr>
                                    )}
                                  </For>
                                </table>
                              </div>
                            </>
                          )}
                        </Match>
                      </Switch>
                    )}
                  </div>
                )}
              </div>
              <div class="stats-col">
                <h2>
                  Requests <small class="muted">(last 30 days)</small>
                </h2>

                <p class="mb2">
                  {data.event_c_30d_avg.toLocaleString()} events per day{' '}
                  <span class="muted">(avg.)</span>
                </p>
                <DailyGraph data={data.daily_events} label="Events" />
                <p class="mb2">
                  {data.ping_c_30d_avg.toLocaleString()} pings per day{' '}
                  <span class="muted">(avg.)</span>
                </p>
                <DailyGraph data={data.daily_pings} label="Pings" />
                <p class="mb2">
                  {data.dash_c_30d_avg.toLocaleString()} dash requests per day{' '}
                  <span class="muted">(avg.)</span>
                </p>
                <DailyGraph data={data.daily_dash} label="Dash Requests" />
              </div>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
};

export default StatsPage;
