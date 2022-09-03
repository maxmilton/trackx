import './index.xcss';

import type { RouteComponent } from '@maxmilton/solid-router';
import { IconSearch, IconX } from '@trackx/icons';
import { createEffect, createResource, createSignal } from 'solid-js';
import { For, Match, Switch } from 'solid-js/web';
import type { ProjectList } from '../../../../trackx-api/src/types';
import { renderErrorAlert } from '../../components/ErrorAlert';
import { Loading } from '../../components/Loading';
import { compactNumber, config, fetchJSON } from '../../utils';

const ProjectsPage: RouteComponent = () => {
  let list: ProjectList;
  const [projects, { mutate }] = createResource<ProjectList, string>(
    `${config.DASH_API_ENDPOINT}/project/all`,
    (url) => fetchJSON<ProjectList>(url).then((data) => {
      list = data;
      return data;
    }),
  );
  const [searchText, setSearchText] = createSignal('');

  createEffect(() => {
    document.title = 'Projects | TrackX';
  });

  function search(text: string) {
    setSearchText(text);
    mutate(
      list.filter((project) => `${project.name},${project.tags || ''}`
        .toLowerCase()
        .includes(text.toLowerCase())),
    );
  }

  function cancelSearch() {
    setSearchText('');
    mutate(list);
  }

  return (
    <div class="con">
      <div class="dfc">
        <h1>Projects</h1>

        <div class="ml-auto">
          <a href="/projects/new" class="button ma0">
            {/* https://github.com/tailwindlabs/heroicons/blob/master/optimized/outline/plus.svg */}
            <svg viewBox="0 0 24 24" class="icon icon-plus dib">
              <path d="M12 4v16m8-8H4" />
            </svg>
            New
          </a>
        </div>
      </div>

      <div class="pos-r search w100 mb3">
        <input
          id="search"
          type="text"
          class="input w100"
          value={searchText()}
          placeholder="Search projects…"
          disabled={projects.loading}
          onInput={(event) => {
            search(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              cancelSearch();
            }
          }}
        />
        <IconSearch />
        {searchText() && (
          <button
            class="button-cancel-search button"
            title="Cancel search"
            onClick={cancelSearch}
          >
            <IconX />
          </button>
        )}
      </div>

      <Switch fallback={<p class="danger">Failed to load projects</p>}>
        <Match when={projects.error} children={renderErrorAlert} keyed />
        <Match when={projects.loading}>
          <Loading />
        </Match>
        <Match when={projects()} keyed>
          {(projectsData) => (
            <>
              <div class="mb3 tr">
                {searchText()
                  ? `showing ${projectsData.length.toLocaleString()} of `
                  : ''}
                {list.length.toLocaleString()} project
                {list.length === 1 ? '' : 's'}
              </div>
              <div class="grid ns-gx2">
                <For each={projectsData}>
                  {(project) => (
                    <div class="project-card card">
                      <div class="card-body">
                        <h2 class="mt0">
                          {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
                          <a
                            href={`/projects/${project.name}`}
                            class="db"
                            textContent={project.name}
                          />
                        </h2>

                        <div>
                          <span
                            aria-label={(project.issue_c || 0).toLocaleString()}
                            data-tooltip
                          >
                            {compactNumber(project.issue_c || 0, true)} issue
                            {project.issue_c === 1 ? '' : 's'}
                          </span>
                          {project.session_c && (
                            <>
                              <span class="ph2 muted">|</span>
                              <span
                                aria-label={project.session_c.toLocaleString()}
                                data-tooltip
                              >
                                {compactNumber(project.session_c, true)} session
                                {project.session_c === 1 ? '' : 's'}
                              </span>
                            </>
                          )}
                          {project.tags && (
                            <>
                              <span class="ph2 muted">|</span>
                              {project.tags.split(',').map((tag) => (
                                <button
                                  class="button-tag button tag"
                                  onClick={() => search(tag)}
                                  textContent={tag}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
};

export default ProjectsPage;
