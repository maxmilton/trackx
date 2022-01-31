import { useURLParams, type RouteComponent } from '@maxmilton/solid-router';
import { IconChevronRight, IconHelp } from '@trackx/icons';
import reltime from '@trackx/reltime';
import {
  batch,
  createEffect,
  createResource,
  onMount,
  type Component,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { For, Match, Switch } from 'solid-js/web';
import type {
  ProjectOverview,
  SessionsData,
} from '../../../../../trackx-api/src/types';
import { renderErrorAlert } from '../../../components/ErrorAlert';
import { Graph } from '../../../components/Graph';
import { Loading } from '../../../components/Loading';
import { compactNumber, config, fetchJSON } from '../../../utils';
import './index.xcss';

interface SessionPeriodInfoProps {
  data: SessionsData['period'];
}

const SessionPeriodInfo: Component<SessionPeriodInfoProps> = (props) => {
  const currentSess = props.data[0][0] || 0;
  const currentSessX = props.data[0][1] || 0;
  const previousSess = props.data[1][0] || 0;
  const previousSessX = props.data[1][1] || 0;
  const currentRate = (1 - currentSessX / currentSess) * 100 || 100;
  const previousRate = (1 - previousSessX / previousSess) * 100 || 100;
  // percent change
  const changeSessions = ((currentSess - previousSess) / previousSess) * 100;
  // difference
  const changeRate = currentRate - previousRate;

  if (currentSess === 0 && previousSess === 0) {
    return <div class="ns-ml2 mb2 lead">No session data for this period</div>;
  }

  // TODO: More sessions doesn't always mean better e.g., node apps or projects
  // which don't use the ping feature, so should the "↑" color always be green?
  //  ↳ Maybe we should have a way to set a project type? But then what about
  //    projects which simply don't use the ping feature?

  return (
    <div class="ns-ml2 mb2">
      <span
        class="fsl fwm"
        aria-label={currentSess.toLocaleString()}
        data-tooltip
      >
        {compactNumber(currentSess)}
      </span>{' '}
      {changeSessions < 0 ? (
        <span class="danger">↓</span>
      ) : (
        <span class="success">↑</span>
      )}{' '}
      <span
        aria-label={`${previousSess.toLocaleString()} last period`}
        data-tooltip
      >
        {+Math.abs(changeSessions).toFixed(1)}%
      </span>
      <span class="muted mh2">|</span>
      <span class="fsl fwm">{+currentRate.toFixed(2)}%</span> error-free{' '}
      {previousSess ? (
        <>
          {changeRate < 0 ? (
            <span class="danger">↓</span>
          ) : (
            <span class="success">↑</span>
          )}{' '}
          <span
            aria-label={`${+previousRate.toFixed(2)}% last period`}
            data-tooltip
          >
            {+Math.abs(changeRate).toFixed(2)}%
          </span>
        </>
      ) : (
        ''
      )}
    </div>
  );
};

// TODO: Show times in user local timezone + align graphs to the timezone and/or
// provide a button to toggle between the two

// TODO: Add "custom" period with "from" and "to" date inputs

// TODO: Drill down to period when clicking on a graph node item

// TODO: Show current day/hour as a dashed line (to indicate it's still ongoing)

// TODO: This should be shared so there's a single point of truth
//  ↳ packages/trackx-api/src/routes/dash/project/[name]/sessions.ts
const VALID_PERIOD_VALUES = ['day', '7d', '30d', 'month', '6mo', '12mo'];

const shouldIncludeDate = (period: string) => period === 'day' || period === 'month';
const dateToday = (period?: string) => new Date().toISOString().slice(0, period === 'month' ? 7 : 10);

type HTMLSelectWithText = HTMLSelectElement & {
  $$text?: HTMLOptionElement;
};

// Use a hidden option element to show text within a select element
function setSelectText(el: HTMLSelectWithText, text: string) {
  let option = el.$$text;

  if (!option) {
    // eslint-disable-next-line no-param-reassign, no-multi-assign
    option = el.$$text = document.createElement('option');
    option.hidden = true;
    el.appendChild(option);
  }

  option.text = text;
  option.value = text;
  // eslint-disable-next-line no-param-reassign
  el.value = text;
}

interface ProjectPageState {
  disablePrev: boolean;
  disableNext: boolean;
  period: string;
  date: string;
}

const ProjectPage: RouteComponent = (props) => {
  const [urlParams, setUrlParams] = useURLParams();
  const initialUrlParams = urlParams();
  const initialPeriod = typeof initialUrlParams.period === 'string'
    && VALID_PERIOD_VALUES.includes(initialUrlParams.period)
    ? initialUrlParams.period
    : '30d';
  const [state, setState] = createStore<ProjectPageState>({
    period: initialPeriod,
    date:
      typeof initialUrlParams.date === 'string'
      && Date.parse(initialUrlParams.date)
        ? initialUrlParams.date
        : dateToday(initialPeriod),
    get disablePrev() {
      return !shouldIncludeDate(this.period);
    },
    get disableNext() {
      return (
        (this.period !== 'day' && this.period !== 'month')
        || this.date === dateToday(this.period)
      );
    },
  });
  const [sessions] = createResource<SessionsData, string>(
    () => `${config.DASH_API_ENDPOINT}/project/${
      props.params.name
    }/sessions?period=${state.period}${
      shouldIncludeDate(state.period) ? `&date=${state.date}` : ''
    }`,
    fetchJSON,
  );
  const [project] = createResource<ProjectOverview, string>(
    () => `${config.DASH_API_ENDPOINT}/project/${props.params.name}/overview`,
    fetchJSON,
  );
  let selectRef: HTMLSelectElement;

  createEffect(() => {
    document.title = `${props.params.name} | TrackX`;
  });

  onMount(() => {
    if (initialUrlParams.date && state.date) {
      setSelectText(selectRef, state.date);
    }
  });

  function handleDateNav(prev?: boolean) {
    const newDate = new Date(state.date);
    let date;

    if (state.period === 'day') {
      newDate.setUTCDate(newDate.getUTCDate() + (prev ? -1 : 1));
      date = newDate.toISOString().slice(0, 10);
      // } else if (state.period === 'month') {
    } else {
      newDate.setUTCMonth(newDate.getUTCMonth() + (prev ? -1 : 1));
      date = newDate.toISOString().slice(0, 7);
    }

    setState({ date });
    setSelectText(selectRef, date);
    setUrlParams({
      ...urlParams(),
      date,
    });
  }

  return (
    <div class="con">
      <div class="dfc muted">
        <a href="/projects" class="muted">
          Projects
        </a>
        <IconChevronRight />
        <span class="text fwm" textContent={props.params.name!} />
      </div>

      <div class="ns-dfc">
        {/* eslint-disable-next-line jsx-a11y/heading-has-content */}
        <h1 textContent={props.params.name!} />

        <div class="ml-auto">
          <a
            href={`/projects/${props.params.name}/install`}
            class="button ma0 mr2"
          >
            Install
          </a>
          <a
            href={`/projects/${props.params.name}/settings`}
            class="button ma0 ml0"
          >
            Settings
          </a>
        </div>
      </div>

      <div class="sessions-card card mt3 ns-mt0 mh-3 ns-mh0 pa3">
        <div class="ns-df ais">
          <h2 class="mt1 ns-ml2">
            Sessions{' '}
            <a
              href={`${config.DOCS_URL}/#/privacy-and-user-data.md#how-are-sessions-calculated`}
              class="link-help dib"
              target="_blank"
              rel="noopener"
              aria-label="Times are UTC\nSee docs to learn how sessions are calculated"
              data-tooltip
            >
              <IconHelp />
            </a>
          </h2>

          <div class="dfc mb3 ns-mb0 ns-ml-auto">
            <div class="button-group mr-auto ns-mr3">
              <button
                class="button flip-icon"
                disabled={state.disablePrev}
                title="Previous date"
                onClick={() => handleDateNav(true)}
              >
                <IconChevronRight />
              </button>
              <button
                class="button"
                disabled={state.disableNext}
                title="Next date"
                onClick={() => handleDateNav()}
              >
                <IconChevronRight />
              </button>
            </div>

            <select
              // @ts-expect-error - ref not actually used before define
              ref={selectRef}
              id="period"
              class="select"
              value={state.period}
              onInput={(event) => {
                const period = event.currentTarget.value;

                batch(() => {
                  let date;
                  if (shouldIncludeDate(period)) {
                    date = dateToday(period);
                    setState({ date });
                  }

                  setState({ period });
                  setUrlParams({
                    ...urlParams(),
                    date,
                    period,
                  });
                });
              }}
            >
              <option value="day">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="month">Month-to-date</option>
              <option value="6mo">Last 6 months</option>
              <option value="12mo">Last 12 months</option>
            </select>
          </div>
        </div>

        <Switch fallback={<p class="danger">Failed to load sessions</p>}>
          <Match when={sessions.error} children={renderErrorAlert} />
          <Match when={sessions.loading}>
            <Loading />
          </Match>
          <Match when={sessions()}>
            {(sessionsData) => (
              <>
                <SessionPeriodInfo data={sessionsData.period} />

                {/*
                TODO: Add documentation that this graph is interactive
                  ↳ Click+drag to select an area and zoom into it
                  ↳ Double click to reset zoom
                  ↳ Click on a series to show/hide
                  ↳ Also note other graphs are not zoomable, otherwise it would
                    probably get in the way
                */}

                <Graph
                  data={sessionsData.graph}
                  opts={{
                    // @ts-expect-error - FIXME:!
                    select: {
                      show: true,
                    },
                    series: [
                      {},
                      {
                        label: 'Sessions',
                        width: 2,
                        stroke: '#15b371', // green4
                        fill: '#0f99601a', // green3 + 0.1 alpha
                        points: {
                          show: false,
                        },
                      },
                      {
                        label: 'With Error',
                        width: 2,
                        stroke: '#f55656', // red4
                        fill: '#db37371a', // red3 + 0.1 alpha
                        points: {
                          show: false,
                        },
                      },
                    ],
                  }}
                  yAuto
                />
              </>
            )}
          </Match>
        </Switch>
      </div>

      <Switch fallback={<p class="danger">Failed to load project</p>}>
        <Match when={project.error} children={renderErrorAlert} />
        <Match when={project.loading}>
          <Loading />
        </Match>
        <Match when={project()}>
          {(projectData) => (
            <div class="l-df">
              <div class="card l-w50 mt3 mh-3 ns-mh0 l-mr3 pa3">
                <div class="ns-df aib">
                  <h2 class="mt1">Latest Unresolved Issues</h2>

                  {/* TODO: This is currently the only way to view /issues with a
                  project filter. The issues list page should probably have some
                  way to select the project. */}
                  <a
                    href={`/issues?project=${props.params.name}`}
                    class="button mb3 ns-ml-auto"
                  >
                    View all issues
                  </a>
                </div>

                <For
                  each={projectData.issues}
                  fallback={<p class="lead">No issues</p>}
                >
                  {(row) => (
                    <div class="mh-3 pv2 ph3 project-list-item">
                      <div class="break clip">
                        <a href={`/issues/${row.id}`}>
                          <span textContent={row.name || 'Error'} />
                          <span
                            class="muted ml2 fwl"
                            textContent={row.uri || '??'}
                          />
                        </a>
                      </div>
                      <div
                        class="break clip"
                        textContent={row.message || '<unknown>'}
                      />
                      <small class="muted">
                        last seen {reltime(row.ts_last)}
                      </small>
                    </div>
                  )}
                </For>
              </div>
              <div class="card l-w50 mt3 mh-3 ns-mh0 pa3">
                <h2 class="mt1">Top Issue URIs</h2>

                {/* TODO: Is this actually useful? For now it's a placeholder
                so we have more to show on this project overview page... */}

                <For
                  each={projectData.uris}
                  fallback={<p class="lead">No issues</p>}
                >
                  {(row) => (
                    <div class="mh-3 pv2 ph3 project-list-item">
                      <div class="break clip">
                        {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
                        <a
                          href={`/issues?q=${encodeURIComponent(
                            `uri:"${row.uri}"`,
                          )}&sort=last_seen&project=${props.params.name}`}
                          textContent={row.uri || '<unknown>'}
                        />
                      </div>
                      <div>{compactNumber(row.uri_c)} issues</div>
                      <small class="muted">
                        last {reltime(row.ts_last, true)} | first{' '}
                        {reltime(row.ts_first, true)}
                      </small>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
};

export default ProjectPage;
