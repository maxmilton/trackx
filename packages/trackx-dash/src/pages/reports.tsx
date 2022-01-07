import type { RouteComponent } from '@maxmilton/solid-router';
import { IconChevronRight } from '@trackx/icons';
import reltime from '@trackx/reltime';
import {
  createEffect, createResource, onError, untrack,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import {
  For, Match, Show, Switch,
} from 'solid-js/web';
// import type { EventType as _EventType } from 'trackx/types';
import { EventType } from 'trackx/types';
import { renderErrorAlert } from '../components/ErrorAlert';
import { Loading } from '../components/Loading';
import { adHocQuery } from '../utils';
import './issues/index.xcss';
import { goToIssue } from './logs';

interface ReportData {
  id: number;
  ts: number;
  type: EventType;
  data: string;
  project_name: string;
  result_c: number;
}

const RESULT_LIMIT = 25;

const ReportsPage: RouteComponent = () => {
  const [state, setState] = createStore({
    error: null as any,
    disableNext: true,
    disablePrev: true,
    resultsFrom: 0,
    resultsTo: 0,
    resultsTotal: 0,
    offset: 0,
  });

  onError((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    setState({ error });
  });

  const [reports] = createResource<ReportData[], string>(
    () => `
WITH
  cte_data AS (
    SELECT
      id,
      ts,
      type,
      data,
      (SELECT name FROM project WHERE project.id = event.project_id) AS project_name
    FROM event
    WHERE type BETWEEN 5 AND 69
      OR type BETWEEN 74 AND 96
  ),
  cte_count AS (
    SELECT COUNT(*) AS result_c FROM cte_data
  )
SELECT *
FROM cte_data
CROSS JOIN cte_count
ORDER BY ts DESC
LIMIT ${RESULT_LIMIT} OFFSET ${state.offset}
    `,
    (sql) => adHocQuery(sql),
  );

  createEffect(() => {
    document.title = 'Reports | TrackX';
  });

  createEffect(() => {
    const data = reports();

    untrack(() => {
      if (data) {
        const resultsTotal = data[0]?.result_c || 0;
        const resultsFrom = state.offset;
        const resultsTo = state.offset + data.length;

        setState({
          disableNext: resultsTo >= resultsTotal,
          disablePrev: resultsFrom < RESULT_LIMIT,
          resultsFrom,
          resultsTo,
          resultsTotal,
        });
      }
    });
  });

  function handlePrev() {
    if (!reports.loading) {
      setState({ offset: state.offset - RESULT_LIMIT });
    }
  }
  function handleNext() {
    if (!reports.loading) {
      setState({ offset: state.offset + RESULT_LIMIT });
    }
  }

  const NavButtons = () => (
    <nav class="button-group">
      <button
        class="button flip-icon"
        disabled={state.disablePrev}
        title="Previous results"
        onClick={handlePrev}
      >
        <IconChevronRight />
      </button>
      <button
        class="button"
        disabled={state.disableNext}
        title="Next results"
        onClick={handleNext}
      >
        <IconChevronRight />
      </button>
    </nav>
  );

  return (
    <div class="con">
      <h1>Reports</h1>

      <div class="alert alert-warning">
        <strong>WARNING:</strong> Reports are currently a{' '}
        <abbr title="proof of concept">PoC</abbr> to collect samples.
      </div>

      <Show when={state.error} children={renderErrorAlert} />

      <div class="dfc mb3">
        <div class="ml-auto mr3">
          {state.resultsTotal <= RESULT_LIMIT
            ? state.resultsTo
            : `${state.resultsFrom + 1} to ${
              state.resultsTo
            } of ${state.resultsTotal.toLocaleString()}`}{' '}
          report{state.resultsTo === 1 ? '' : 's'}
        </div>
        <NavButtons />
      </div>

      <Switch fallback={<p class="danger">Failed to load reports</p>}>
        <Match when={reports.error} children={renderErrorAlert} />
        <Match when={reports.loading}>
          <div class="df ahm">
            <Loading />
          </div>
        </Match>
        <Match when={reports()}>
          {(data) => (
            <table class="results-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Link</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={data}
                  fallback={
                    <tr>
                      <td class="gw2 lead tc">No reports</td>
                    </tr>
                  }
                >
                  {(row) => (
                    <tr>
                      <td>
                        <span textContent={row.id} />
                        <span class="mh2 muted">|</span>
                        <span
                          // @ts-expect-error - row.type coerced to string
                          textContent={EventType[row.type] || EventType[98]}
                        />
                        <span
                          class="ml2 muted"
                          textContent={`(${JSON.parse(row.data).agent})`}
                        />
                        <div>
                          <small class="muted">
                            {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
                            <a
                              href={`/projects/${row.project_name}`}
                              class="muted fwn mr2"
                              textContent={row.project_name}
                            />{' '}
                            {reltime(row.ts, true)}
                          </small>
                        </div>
                      </td>
                      <td>
                        <button
                          class="button wsn"
                          onClick={(event) => goToIssue(event, row.id)}
                        >
                          Go to issue
                        </button>
                      </td>
                      <td>
                        <button
                          class="button wsn"
                          onClick={() => {
                            console.log(`REPORT ${row.id}`, {
                              project: row.project_name,
                              ...JSON.parse(row.data),
                            });
                          }}
                        >
                          Log to console
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          )}
        </Match>
      </Switch>

      <div class="df mt3">
        <div class="ml-auto">
          <NavButtons />
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
