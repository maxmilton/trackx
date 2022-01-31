import { useURLParams, type RouteComponent } from '@maxmilton/solid-router';
import { IconChevronRight, IconSearch, IconX } from '@trackx/icons';
import reltime from '@trackx/reltime';
import {
  createEffect, createResource, onError, untrack,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { For, Show, Suspense } from 'solid-js/web';
import type { Issue } from '../../../../trackx-api/src/types';
import { renderErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { compactNumber, config, fetchJSON } from '../../utils';
import './index.xcss';

const RESULT_LIMIT = 25;

// TODO: Would be preferable to have a single source of truth for values like
// this which are shared between API and web app; use same data as packages/trackx-api/src/utils.ts
const VALID_SORT_VALUES = [
  'last_seen',
  'first_seen',
  'event_count',
  'sess_count',
  'rank',
];

type SortValue = typeof VALID_SORT_VALUES[number];

function isValidSort(query: unknown): query is SortValue {
  return (
    typeof query === 'string'
    && (VALID_SORT_VALUES as ReadonlyArray<string>).includes(query)
  );
}

const IssuesPage: RouteComponent = () => {
  const [urlParams, setUrlParams] = useURLParams();
  const initialUrlParams = urlParams();
  const [state, setState] = createStore({
    error: null as any,
    disableNext: true,
    disablePrev: true,
    resultsFrom: 0,
    resultsTo: 0,
    resultsTotal: 0,
    searchText: decodeURIComponent((initialUrlParams.q as string) || ''),
    sort:
      initialUrlParams.sort && isValidSort(initialUrlParams.sort)
        ? initialUrlParams.sort
        : (initialUrlParams.q
          ? 'rank'
          : 'last_seen'),
    offset: 0,
  });
  const [issues, { refetch }] = createResource<Issue[], string>(
    // Untrack changes to state.searchText because we manually refetch on
    // enter key press in the search input to prevent excessive requests
    () => `${config.DASH_API_ENDPOINT}/issue/${untrack(() => (state.searchText
      ? `search?q=${encodeURIComponent(state.searchText)}&`
      : 'all?'))}limit=${RESULT_LIMIT}&offset=${state.offset}&sort=${state.sort}${
      initialUrlParams.project ? `&project=${initialUrlParams.project}` : ''
    }`,
    fetchJSON,
    { initialValue: [] },
  );

  onError((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    setState({ error });
  });

  // This resource uses Suspense, not Switch, so it needs a separate error trigger
  createEffect(() => {
    if (issues.error) throw issues.error;
  });

  createEffect(() => {
    document.title = 'Issues | TrackX';
  });

  createEffect(() => {
    const data = issues();

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
    if (!issues.loading) {
      setState({ offset: state.offset - RESULT_LIMIT });
    }
  }
  function handleNext() {
    if (!issues.loading) {
      setState({ offset: state.offset + RESULT_LIMIT });
    }
  }

  function cancelSearch() {
    setState({
      error: null,
      searchText: '',
      sort: 'last_seen',
      offset: 0,
    });
    setUrlParams((prev) => ({
      ...prev,
      q: undefined,
      sort: undefined,
    }));
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
      <h1>
        Issues{' '}
        <span
          class="muted"
          textContent={`(${
            initialUrlParams.project ? initialUrlParams.project : 'All Projects'
          })`}
        />
      </h1>

      <Show when={state.error} children={renderErrorAlert} />

      {/*
        TODO: Should we add a note mentioning search supports advanced query
        syntax features? Could also add a link to the docs and explain in detail
        there, rather than linking to SQLite docs which would be confusing for
        actual users; https://www.sqlite.org/fts5.html#full_text_query_syntax
          ↳ Probably a link to our docs would be enough
          ↳ A particuarly useful feature is search in a particular DB column,
            for example to search location/url which contain 404 only; uri:404
            ↳ Only on search indexed columns; name, message, uri
      */}

      <div class="df avb mb3">
        <div class="pos-r search w100">
          {/* TODO: Input validation to ensure minLength */}
          <input
            id="search"
            type="text"
            class="input w100"
            value={state.searchText}
            placeholder="Search issues…"
            minLength={3}
            // required
            onInput={(event) => {
              setState({ searchText: event.currentTarget.value });
            }}
            onKeyDown={(event) => {
              switch (event.key) {
                case 'Enter': {
                  const self = event.currentTarget;

                  // dirty(self);

                  // if (self.checkValidity()) {
                  //   self.setCustomValidity('3 characters or more required');
                  //   self.classList.add('invalid');
                  //   return;
                  // }

                  // self.classList.remove('invalid');

                  setState({
                    error: null,
                    offset: 0,
                    sort: 'rank',
                  });

                  setUrlParams((prev) => ({
                    ...prev,
                    q: state.searchText,
                    sort: undefined,
                  }));

                  // Updates to sort/offset already trigger resource fetch
                  const shouldFetch = state.sort === 'rank' && state.offset === 0;

                  if (shouldFetch) refetch();

                  // Dismiss mobile on-screen keybaord (without losing focus)
                  self.readOnly = true;
                  setTimeout(() => {
                    self.readOnly = false;
                  });
                  break;
                }
                case 'Escape':
                  cancelSearch();
                  break;
                default:
                // No op
              }
            }}
          />
          <IconSearch />
          {state.searchText && (
            <button class="button-cancel-search button" onClick={cancelSearch}>
              <IconX />
            </button>
          )}
        </div>

        <div class="ml2">
          <label htmlFor="sort" class="mt-3 label muted">
            Sort by
          </label>
          <select
            id="sort"
            class="select"
            value={state.sort}
            onInput={(event) => {
              const sort = event.currentTarget.value;
              setState({
                offset: 0, // reset pagination
                sort,
              });
              setUrlParams((prev) => ({
                ...prev,
                sort,
              }));
            }}
          >
            <option value="rank" disabled={!state.searchText}>
              Search Rank
            </option>
            {/* <option value="priority">Priority</option> */}
            <option value="last_seen">Last Seen</option>
            <option value="first_seen">First Seen</option>
            <option value="event_count">Events</option>
            <option value="sess_count">Sessions</option>
          </select>
        </div>
      </div>

      <div class="dfc mb3">
        <div class="ml-auto mr3">
          {state.resultsTotal <= RESULT_LIMIT
            ? state.resultsTo
            : `${state.resultsFrom + 1} to ${
              state.resultsTo
            } of ${state.resultsTotal.toLocaleString()}`}{' '}
          issue{state.resultsTo === 1 ? '' : 's'}
        </div>
        <NavButtons />
      </div>

      <Suspense fallback={<Loading />}>
        <table class="results-table mh-3 ns-mh0">
          <thead>
            <tr>
              <th></th>
              <th class="dfce">
                Event<span class="dn ns-di">s</span>
              </th>
              <th class="dfce">
                <span class="ns-dn">Sess</span>
                <span class="dn ns-di">Sessions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <For
              each={issues()}
              fallback={
                <tr>
                  <td class="gw3 lead tc">
                    No issues{state.searchText ? ' match your search' : ''}
                  </td>
                </tr>
              }
            >
              {(row) => (
                <tr>
                  <td>
                    <div class="break clip">
                      {(row.ignore || row.done) && (
                        <span class="mr2 muted">
                          {row.ignore && <span class="tag">ignored</span>}
                          {row.done && <span class="tag">done</span>}
                        </span>
                      )}
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
                    <div>
                      <small class="muted">
                        <a
                          href={`/projects/${row.project_name}`}
                          class="muted fwn mr2"
                        >
                          {row.project_name}
                        </a>{' '}
                        <span class="wsn">
                          {reltime(row.ts_last, true)} |{' '}
                          {reltime(row.ts_first, true).replace('ago', 'old')}
                        </span>
                      </small>
                    </div>
                  </td>
                  <td
                    class="dfce"
                    aria-label={row.event_c.toLocaleString()}
                    data-tooltip
                  >
                    {compactNumber(row.event_c)}
                  </td>
                  <td
                    class="dfce"
                    aria-label={row.sess_c.toLocaleString()}
                    data-tooltip
                  >
                    {compactNumber(row.sess_c)}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Suspense>

      <div class="df mt3">
        <div class="ml-auto">
          <NavButtons />
        </div>
      </div>
    </div>
  );
};

export default IssuesPage;
