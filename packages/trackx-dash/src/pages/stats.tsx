import reltime from '@trackx/reltime';
import { createEffect, createResource, type Component } from 'solid-js';
import {
  // For,
  Match,
  Switch,
} from 'solid-js/web';
import UPlot from 'uplot';
import type { Stats, TimeSeriesData } from '../../../trackx-api/src/types';
import { renderErrorAlert } from '../components/ErrorAlert';
import { Graph } from '../components/Graph';
import { Loading } from '../components/Loading';
import { config, fetchJSON } from '../utils';
import './stats.xcss';

interface DailyGraphProps {
  data: TimeSeriesData;
  label: string;
}

const graphSync = UPlot.sync('stats');

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

const StatsPage: Component = () => {
  const [stats] = createResource<Stats, string>(
    () => `${config.DASH_API_ENDPOINT}/stats`,
    fetchJSON,
  );

  createEffect(() => {
    document.title = 'Stats | TrackX';
  });

  return (
    <div class="con">
      <h1>Stats</h1>

      <Switch fallback={<p class="danger">Failed to load stats</p>}>
        <Match when={stats.error} children={renderErrorAlert} />
        <Match when={stats.loading}>
          <Loading />
        </Match>
        <Match when={stats()}>
          {(data) => (
            <div class="df f-col ns-f-row">
              <div class="stats-col ns-mr4">
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

                <hr />

                <h2>
                  Requests <small class="muted">(last 30 days)</small>
                </h2>

                <p>
                  {data.event_c_30d_avg.toLocaleString()} events per day{' '}
                  <span class="muted">(avg.)</span>
                </p>
                <DailyGraph data={data.daily_events} label="Events" />
                <p>
                  {data.ping_c_30d_avg.toLocaleString()} pings per day{' '}
                  <span class="muted">(avg.)</span>
                </p>
                <DailyGraph data={data.daily_pings} label="Pings" />

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
                    API up since {reltime(Date.now() - data.api_uptime * 1000)}
                  </span>
                </p>
                <p>
                  {data.dash_session_c.toLocaleString()} active dash session
                  {data.dash_session_c === 1 ? '' : 's'}
                </p>
              </div>
              <div>
                <h2>Database</h2>

                {/* TODO: Remove class=wsnb once no longer necessary */}
                <p class="wsnb">
                  {data.db_size}
                  <span class="muted"> + </span>
                  {data.dbwal_size}
                  <span class="muted"> (wal)</span>
                </p>

                {/* FIXME: Generating DB table stats is extremely slow on systems
                with slow disks -- https://github.com/maxmilton/trackx/issues/158 */}
                {/*
                <h3>Tables</h3>

                <div class="table-wrapper">
                  <table class="table wi tr tnum">
                    <For each={data.db_tables} fallback="No data">
                      {([name, size, percent]) => (
                        <tr>
                          <td class="tl break" textContent={name} />
                          <td class="wsn" textContent={size} />
                          <td textContent={percent} />
                        </tr>
                      )}
                    </For>
                  </table>
                </div>
                */}
              </div>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
};

export default StatsPage;
