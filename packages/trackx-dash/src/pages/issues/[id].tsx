/* eslint-disable no-underscore-dangle */

import './[id].xcss';

import {
  routeTo,
  useURLParams,
  type RouteComponent,
} from '@maxmilton/solid-router';
import {
  IconCheck,
  IconChevronRight,
  IconExternalLink,
  IconSkip,
  IconTrash,
} from '@trackx/icons';
import reltime from '@trackx/reltime';
import { createEffect, createResource, onError } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Match, Show, Switch } from 'solid-js/web';
import type { Event, Issue } from '../../../../trackx-api/src/types';
import { renderErrorAlert } from '../../components/ErrorAlert';
import { Sparkline } from '../../components/Graph';
// import { Dialog } from '../../components/Dialog';
import { Loading } from '../../components/Loading';
import { StackTrace } from '../../components/StackTrace';
import {
  AppError, config, fetchJSON, logout,
} from '../../utils';

// Matches equivalent client enum in packages/trackx/types.ts
const EventType = {
  1: 'Unhandled Error',
  2: 'Unhandled Rejection',
  3: 'Console Error',
  4: 'Programmatic',
  5: 'Content Security Policy Report',
  6: 'Deprecation Report',
  7: 'Intervention Report',
  8: 'Crash Report',
  9: 'Certificate Transparency Report',
  10: 'Network Error Logging Report',
  11: 'Cross-Origin Embedder Policy Report',
  12: 'Cross-Origin Opener Policy Report',
  13: 'Document Policy Report',
  70: 'Custom Logger',
  96: 'Unknown Report',
  97: 'Unknown Event',
  98: 'Unknown',
  99: 'Test',
} as const;

const ClientType = {
  d: 'Default',
  l: 'Lite',
  m: 'Modern',
  e: 'Extended',
  c: 'Compat',
  n: 'Node',
  _: 'Custom',
} as const;

function isEventWithStack(type: number) {
  return [1, 2, 3, 4, 70, 97, 98, 99].includes(type);
}

function safeStringifyPretty(data: any): string {
  let out = data;

  if (data != null && typeof data === 'object') {
    try {
      out = JSON.stringify(data, null, 2);
    } catch {
      /* No op */
    }
  }

  return out as string;
}

const IssuePage: RouteComponent = (props) => {
  const [urlParams, setUrlParams] = useURLParams();
  const initialUrlParams = urlParams();
  const [state, setState] = createStore({
    error: null as unknown,
    disablePrev: true,
    disableNext: true,
    dir: initialUrlParams.event ? null : 'last',
    eventId: (initialUrlParams.event as string | number) || null,
  });
  const [issue, { mutate }] = createResource<Issue, string>(
    `${config.DASH_API_ENDPOINT}/issue/${props.params.id}`,
    fetchJSON,
  );
  const [event] = createResource(
    () => `${config.DASH_API_ENDPOINT}/issue/${props.params.id}/event/${
      state.eventId
    }${state.dir ? `?dir=${state.dir}` : ''}`,
    (url) => fetchJSON<Event>(url).then((data) => {
      // Expand short internal meta keys into a human readable form
      // eslint-disable-next-line @typescript-eslint/naming-convention, object-curly-newline
      const { _c, _v, _size, ...rest } = data.data.meta || {};

      // eslint-disable-next-line no-param-reassign
      data.data.meta = {
        ...rest,
        'Event Size': _size,
      };

      if (isEventWithStack(data.type)) {
        // eslint-disable-next-line no-param-reassign
        data.data.meta['TrackX Client'] = `${
          (_c && ClientType[_c]) || _c || '?'
        } v${_v || '?'}`;
      }

      return data;
    }),
  );
  let eventFetchInProgress = false;
  let currentEventId = state.eventId;

  onError((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    setState({ error });
  });

  createEffect(() => {
    // Temporary title until issue data is loaded
    document.title = `Issue ${props.params.id} | TrackX`;
  });

  createEffect(() => {
    const issueData = issue();

    if (issueData) {
      document.title = `${issueData.name || 'Error'}: ${
        issueData.message || '<unknown>'
      }: ${issueData.uri || ''} | TrackX`;
    }
  });

  createEffect(() => {
    const eventData = event();

    if (eventData) {
      setState({
        disablePrev: !!eventData.is_first,
        disableNext: !!eventData.is_last,
      });
      setUrlParams((prev) => ({
        ...prev,
        event: eventData.id,
      }));
      currentEventId = eventData.id;
      eventFetchInProgress = false;
    }
  });

  async function handleToggleDone() {
    setState({ error: null });

    try {
      const value = !issue()!.done;
      const res = await fetch(
        `${config.DASH_API_ENDPOINT}/issue/${props.params.id}/resolve`,
        {
          method: 'POST',
          credentials: 'same-origin',
          mode: 'same-origin',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        },
      );

      if (!res.ok) {
        if (res.status === 401) {
          void logout();
          return;
        }

        throw new AppError(await res.text(), res.status);
      }

      mutate((prev) => ({
        ...prev!,
        done: value,
      }));
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setState({ error });
    }
  }

  async function handleToggleIgnore() {
    setState({ error: null });

    try {
      const value = !issue()!.ignore;
      const res = await fetch(
        `${config.DASH_API_ENDPOINT}/issue/${props.params.id}/ignore`,
        {
          method: 'POST',
          credentials: 'same-origin',
          mode: 'same-origin',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        },
      );

      if (!res.ok) {
        if (res.status === 401) {
          void logout();
          return;
        }

        throw new AppError(await res.text(), res.status);
      }

      mutate((prev) => ({
        ...prev!,
        ignore: value,
      }));
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setState({ error });
    }
  }

  // FIXME: Show a confirmation dialog before deleting as it's irreversible!!
  async function handleDelete() {
    setState({ error: null });

    try {
      const res = await fetch(
        `${config.DASH_API_ENDPOINT}/issue/${props.params.id}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          mode: 'same-origin',
          redirect: 'error',
        },
      );

      if (!res.ok) {
        if (res.status === 401) {
          void logout();
          return;
        }

        throw new AppError(await res.text(), res.status);
      }

      await routeTo('/issues');
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setState({ error });
    }
  }

  const handleToEvent = (dir: 'first' | 'prev' | 'next' | 'last') => () => {
    if (eventFetchInProgress) return;

    eventFetchInProgress = true;
    // Trigger fetching the next event
    setState({ error: null, dir, eventId: currentEventId });
  };

  return (
    <div class="con">
      <div class="dfc muted">
        <a href="/issues" class="muted">
          Issues
        </a>
        <IconChevronRight />
        <span class="text fwm" textContent={`#${props.params.id}`} />
      </div>

      <Show when={state.error} children={renderErrorAlert} />

      <Switch fallback={<p class="danger">Failed to load issue</p>}>
        <Match when={issue.error} children={renderErrorAlert} />
        <Match when={issue.loading}>
          <Loading />
        </Match>
        <Match when={issue()}>
          <>
            <div class="l-dfb">
              {/* FIXME: Clamping the max lines here is nice to not flood the
                UI with text but might there be a better way in case someone
                actually wanted to read the full text string? */}
              <h1 class="break clamp">
                <b textContent={issue()!.name || 'Error'} />:{' '}
                <span textContent={issue()!.message || '<unknown>'} />
              </h1>

              <div class="df ml-auto l-pl3 fsn">
                <button
                  class={`button mr2${issue()!.done ? ' button-success' : ''}`}
                  title={
                    issue()!.done
                      ? 'Mark issue as unresolved'
                      : 'Mark issue as resolved'
                  }
                  onClick={handleToggleDone}
                >
                  {issue()!.done ? <IconCheck /> : 'Mark resolved'}
                </button>
                <button
                  class={`button mr2${issue()!.ignore ? ' button-danger' : ''}`}
                  title={
                    issue()!.ignore
                      ? 'Matching events are ignored. Click to capture future similar events'
                      : 'Matching events are captured. Click to ignore future similar events'
                  }
                  onClick={handleToggleIgnore}
                >
                  {issue()!.ignore ? 'Ignored' : 'Ignore'}
                </button>
                <button
                  class="button"
                  title="Delete issue"
                  onClick={handleDelete}
                >
                  <IconTrash />
                </button>
              </div>
            </div>

            <div class="mt3 l-mt0">
              {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
              <a
                href={`/projects/${issue()!.project_name}`}
                textContent={issue()!.project_name}
              />
              <span class="ph2 muted">|</span>
              {issue()!.event_c.toLocaleString()} event
              {issue()!.event_c === 1 ? '' : 's'}
              <span class="ph2 muted">|</span>
              {issue()!.sess_c.toLocaleString()} session
              {issue()!.sess_c === 1 ? '' : 's'}
            </div>
            <div class="mb3">
              <span
                aria-label={new Date(issue()!.ts_last).toLocaleString()}
                data-tooltip
              >
                Last seen {reltime(issue()!.ts_last)}
              </span>
              <span class="ph2 muted">|</span>
              <span
                aria-label={new Date(issue()!.ts_first).toLocaleString()}
                data-tooltip
              >
                First seen {reltime(issue()!.ts_first)}
              </span>
            </div>
          </>
        </Match>
      </Switch>

      <div class="button-group">
        <button
          class="button flip-icon"
          title="First event"
          disabled={state.disablePrev}
          onClick={handleToEvent('first')}
        >
          <IconSkip />
        </button>
        <button
          class="button flip-icon"
          title="Previous event"
          disabled={state.disablePrev}
          onClick={handleToEvent('prev')}
        >
          Older
        </button>
        <button
          class="button"
          title="Next event"
          disabled={state.disableNext}
          onClick={handleToEvent('next')}
        >
          Newer
        </button>
        <button
          class="button"
          title="Latest event"
          disabled={state.disableNext}
          onClick={handleToEvent('last')}
        >
          <IconSkip />
        </button>
      </div>

      <div class="l-df">
        <div class="issue-main w100">
          <div class="ns-card-body card mt3 mh-3 ns-mh0 pa3">
            <Switch fallback={<p class="danger">Failed to load event</p>}>
              <Match when={event.error} children={renderErrorAlert} />
              <Match when={event.loading}>
                <Loading />
              </Match>
              <Match when={event()}>
                {(eventData) => (
                  <>
                    <h2 class="mt0">
                      Event{' '}
                      <span class="fss fwn muted break">#{eventData.id}</span>
                    </h2>

                    <div class="break">
                      <div>
                        <span class="orange5">Name:</span>{' '}
                        {eventData.data.name || 'Error'}
                      </div>
                      <div>
                        <span class="orange5">Message:</span>{' '}
                        {eventData.data.message || '<unknown>'}
                      </div>
                      <div>
                        <span class="orange5">Type:</span>{' '}
                        {EventType[eventData.type]
                          || `Unknown (${eventData.type})`}
                      </div>
                      <div>
                        <span class="orange5">Time:</span>{' '}
                        {reltime(eventData.ts)}{' '}
                        <span class="muted">
                          ({new Date(eventData.ts).toLocaleString()})
                        </span>
                      </div>
                      <div>
                        <span class="orange5">URI:</span>{' '}
                        {eventData.data.uri && (
                          <a
                            href={eventData.data.uri}
                            target="_blank"
                            rel="noopener"
                          >
                            <span textContent={eventData.data.uri} />{' '}
                            <IconExternalLink />
                          </a>
                        )}
                      </div>
                      <div>
                        <span class="orange5">Agent:</span>{' '}
                        {eventData.data.agent} {eventData.data.agent_v}
                      </div>
                      <div>
                        <span class="orange5">OS:</span> {eventData.data.os}{' '}
                        {eventData.data.os_v}
                      </div>
                    </div>

                    {isEventWithStack(eventData.type) && (
                      <>
                        <h3>Stack Trace</h3>

                        {/* TODO: Add a way to collapse/expand all the stack's frames */}
                        {eventData.data.stack ? (
                          // @ts-expect-error - FIXME:!
                          <StackTrace stack={eventData.data.stack} />
                        ) : (
                          <div class="muted">{'<none>'}</div>
                        )}
                      </>
                    )}

                    <h3>Meta Data</h3>

                    <div class="event-meta break wspw">
                      {Object.keys(eventData.data.meta).map((key) => (
                        <>
                          <div class="event-meta-title">{key}</div>
                          <div
                            class="event-meta-data"
                            textContent={safeStringifyPretty(
                              eventData.data.meta[key],
                            )}
                          />
                        </>
                      ))}
                    </div>

                    {isEventWithStack(eventData.type) && (
                      <>
                        <h3>Original Stack Trace</h3>

                        {eventData.data.stack_raw ? (
                          <code
                            class="code-block mw100 border-dark"
                            textContent={eventData.data.stack_raw}
                          />
                        ) : (
                          <div class="muted">{'<none>'}</div>
                        )}
                      </>
                    )}
                  </>
                )}
              </Match>
            </Switch>
          </div>
        </div>
        <div class="issue-sidebar fsn">
          <h3>Last 24 hours</h3>

          <Sparkline
            // type="event"
            parent={props.params.id!}
            period="24h"
          />
          <h3>Last 30 days</h3>
          <Sparkline
            // type="event"
            parent={props.params.id!}
            period="30d"
          />

          {/* TODO: Show a summary/breakdown of common attributes; % browser
          type, browser major version, OS, platform (desktop, mobile), user
          // supplied meta data (e.g., release, version, environment... but how
          to determine which to report on?) */}

          {/* TODO: What other data might be interesting? Events per session? */}
        </div>
      </div>
    </div>
  );
};

export default IssuePage;
