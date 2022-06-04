// TODO: Make sure the logic is the same as "new project"

// TODO: Reduce the duplication between new project and project settings

// TODO: Better errors for users e.g., "project with same name already exists"

import { RouteComponent, routeTo } from '@maxmilton/solid-router';
import { IconChevronRight } from '@trackx/icons';
import { createEffect, createResource, onError } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Match, Show, Switch } from 'solid-js/web';
import type { Project } from '../../../../../trackx-api/src/types';
import { Dialog } from '../../../components/Dialog';
import { renderErrorAlert } from '../../../components/ErrorAlert';
import { Loading } from '../../../components/Loading';
import {
  AppError, config, fetchJSON, logout,
} from '../../../utils';
import {
  dirty,
  FORBIDDEN_PROJECT_NAMES,
  isNotOrigin,
  validate,
  VALIDATION_ERROR,
} from '../../../validation';

const ProjectSettingsPage: RouteComponent = (props) => {
  const [state, setState] = createStore({
    error: null as unknown,
    validationError: null as unknown,
    disableSubmit: false,
    showConfirmNewKey: false,
    showConfirmRemove: false,
    origin: '',
    name: '',
    scrape: false,
    tags: '',
  });

  onError((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    setState({ error });
  });

  const [project, { mutate }] = createResource<Project, string>(
    () => `${config.DASH_API_ENDPOINT}/project/${props.params.name}`,
    fetchJSON,
  );
  let formRef: HTMLFormElement;

  createEffect(() => {
    document.title = `${props.params.name} Settings | TrackX`;
  });

  createEffect(() => {
    const data = project();

    if (data) {
      setState({
        origin: data.origin,
        name: data.name,
        scrape: data.scrape || false,
        tags: data.tags || '',
      });
    }
  });

  function handleInput(
    event: InputEvent & { currentTarget: HTMLInputElement },
  ) {
    const el = event.currentTarget;
    setState({ [el.id]: el.value.trim() });
    dirty(el);
  }

  function handleInputCheckbox(
    event: MouseEvent & { currentTarget: HTMLInputElement },
  ) {
    const el = event.currentTarget;
    setState({ [el.id]: el.checked });
    dirty(el);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    setState({
      error: null,
      validationError: null,
      disableSubmit: true,
    });

    try {
      // FIXME: Provide reason why invalid in UI + revalidate oninput
      validate(formRef, {
        // eslint-disable-next-line consistent-return
        name(value: string) {
          if (FORBIDDEN_PROJECT_NAMES.includes(value)) {
            return `Name "${value}" is forbidden`;
          }
        },
        origin(value: string) {
          if (value === '*') return;

          if (value.includes('*')) {
            // eslint-disable-next-line consistent-return
            return 'When using * wildcard it must be the only origin';
          }

          const invalidOrigin = value.split(',').some(isNotOrigin);

          if (invalidOrigin) {
            // eslint-disable-next-line consistent-return
            return `Invalid origin "${invalidOrigin}"`;
          }
        },
        // eslint-disable-next-line consistent-return
        tags(value: string) {
          if (value) {
            return value.split(',').some((t) => !t.trim());
          }
        },
      });

      setState({ validationError: null });
    } catch (error: unknown) {
      // form validation error
      if (error instanceof AppError && error.code === VALIDATION_ERROR) {
        setState({
          disableSubmit: false,
          validationError: error,
        });
      } else {
        // eslint-disable-next-line no-console
        console.error(error);
        setState({
          disableSubmit: false,
          error,
        });
      }
      return;
    }

    try {
      const res = await fetch(
        `${config.DASH_API_ENDPOINT}/project/${props.params.name}`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          mode: 'same-origin',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: state.origin,
            name: state.name,
            scrape: state.scrape || undefined,
            tags: state.tags || undefined,
          }),
        },
      );

      if (!res.ok) {
        if (res.status === 401) {
          void logout();
          return;
        }

        throw new AppError(await res.text(), res.status);
      }

      await routeTo(`/projects/${state.name}`);
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setState({
        error,
        disableSubmit: false,
      });
    }
  }

  async function handleGenerateNewKey() {
    setState({
      error: null,
      disableSubmit: true,
    });

    try {
      const res = await fetch(
        `${config.DASH_API_ENDPOINT}/project/${props.params.name}/newkey`,
        {
          method: 'POST',
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

      const key = await res.text();
      mutate((prev) => ({
        ...prev!,
        key,
      }));

      setState({
        disableSubmit: false,
        showConfirmNewKey: false,
      });
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setState({
        error,
        disableSubmit: false,
      });
    }
  }

  // TODO: When a project has a lot of DB entries deleting the project can be
  // slow so should the user be notified? Or maybe should we respond quickly
  // but handle delete async in the background?
  async function handleProjectDelete() {
    setState({
      error: null,
      disableSubmit: true,
    });

    try {
      const res = await fetch(
        `${config.DASH_API_ENDPOINT}/project/${props.params.name}`,
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

      await routeTo('/projects');
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setState({
        error,
        disableSubmit: false,
      });
    }
  }

  return (
    <div class="con">
      <div class="dfc muted">
        <a href="/projects" class="muted">
          Projects
        </a>
        <IconChevronRight />
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
        <a
          href={`/projects/${props.params.name}`}
          class="muted"
          textContent={props.params.name!}
        />

        <IconChevronRight />
        <span class="text fwm">Settings</span>
      </div>

      <Show when={state.error} children={renderErrorAlert} />

      <h1>Project Settings</h1>

      <Switch fallback={<p class="danger">Failed to load project</p>}>
        <Match when={project.error} children={renderErrorAlert} />
        <Match when={project.loading}>
          <Loading />
        </Match>
        <Match when={project()}>
          {/* TODO: projectData is never used since state is updated after
          data fetch... could this be implemented better? */}
          {(projectData) => (
            <>
              <div class="card narrow">
                <form
                  ref={formRef}
                  class="card-body"
                  novalidate
                  onSubmit={handleSubmit}
                >
                  <div class="mb3">
                    <label for="name" class="label">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      class="input w100"
                      value={state.name}
                      placeholder="project-name"
                      required
                      pattern="[a-z0-9_-]{1,40}"
                      onInput={handleInput}
                    />
                    <small class="note">
                      Lowercase a-z letters, numbers, dash, or underscore
                    </small>
                  </div>
                  <div class="mb3">
                    <label for="origin" class="label">
                      Allowed Origins
                    </label>
                    <input
                      id="origin"
                      type="text"
                      class="input w100"
                      value={state.origin}
                      placeholder="*"
                      required
                      maxLength="1024"
                      onInput={handleInput}
                    />
                    <small class="note">
                      "*" or list of{' '}
                      <a
                        href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin"
                        target="_blank"
                        rel="noopener"
                      >
                        HTTP origins
                      </a>{' '}
                      seperated by comma ","
                    </small>
                  </div>
                  <div class="mb3">
                    <label for="tags" class="label">
                      Tags
                    </label>
                    <input
                      id="tags"
                      type="text"
                      class="input w100"
                      value={state.tags}
                      pattern="[\u0020-\u007E]{0,1024}"
                      onInput={handleInput}
                    />
                    <small class="note">
                      ASCII tag names seperated by comma ","
                    </small>
                  </div>
                  <div class="df mb3">
                    <input
                      id="scrape"
                      type="checkbox"
                      class="checkbox"
                      checked={state.scrape}
                      onClick={handleInputCheckbox}
                    />
                    <label for="scrape" class="label">
                      Automatically fetch source maps to enhance stack traces
                    </label>
                  </div>

                  <Show
                    when={state.validationError}
                    children={renderErrorAlert}
                  />

                  <div class="mt4">
                    <button
                      type="submit"
                      class="button button-primary mr3"
                      disabled={state.disableSubmit}
                    >
                      Update project
                    </button>
                    <a href={`/projects/${props.params.name}`} class="button">
                      Cancel
                    </a>
                  </div>
                </form>
              </div>

              <hr class="mv4" />

              <h2>Danger Zone</h2>

              <h3 id="apikey-title">Project API Key</h3>

              <div>
                <input
                  type="text"
                  class="input mb3 code dark5"
                  value={projectData.key}
                  aria-labelledby="apikey-title"
                  disabled
                />
              </div>

              <button
                class="button button-danger-pre"
                type="button"
                onClick={() => setState({ showConfirmNewKey: true })}
              >
                Generate new key
              </button>

              <Show when={state.showConfirmNewKey}>
                <Dialog onClose={() => setState({ showConfirmNewKey: false })}>
                  <h2 class="mt0">
                    Generate new key for <strong>{props.params.name}</strong>?
                  </h2>
                  <p class="lead">Are you absolutely sure?</p>
                  <p class="lead">
                    Your current key will be permanently deleted. Incoming
                    events using the old key will no longer be accepted!
                  </p>
                  <footer class="dialog-footer">
                    <button
                      class="button button-cancel mr2 ph4"
                      type="button"
                      onClick={() => setState({ showConfirmNewKey: false })}
                    >
                      Cancel
                    </button>
                    <button
                      class="button button-danger"
                      type="button"
                      onClick={() => handleGenerateNewKey()}
                      disabled={state.disableSubmit}
                    >
                      Generate new key
                    </button>
                  </footer>
                </Dialog>
              </Show>

              <h3 class="mt4">Delete project</h3>

              <button
                class="button button-danger-pre"
                type="button"
                onClick={() => setState({ showConfirmRemove: true })}
              >
                Delete project
              </button>

              <Show when={state.showConfirmRemove}>
                <Dialog onClose={() => setState({ showConfirmRemove: false })}>
                  <h2 class="mt0">
                    Delete project <strong>{props.params.name}</strong>?
                  </h2>
                  <p class="lead">Are you absolutely sure?</p>
                  <p class="lead">
                    Removing this project is permanent and{' '}
                    <strong>cannot</strong> be undone! This will also remove all
                    associated data.
                  </p>
                  <footer class="dialog-footer">
                    <button
                      class="button button-cancel mr2 ph4"
                      type="button"
                      onClick={() => setState({ showConfirmRemove: false })}
                    >
                      Cancel
                    </button>
                    <button
                      class="button button-danger"
                      type="button"
                      onClick={() => handleProjectDelete()}
                      disabled={state.disableSubmit}
                    >
                      I understand, delete this project
                    </button>
                  </footer>
                </Dialog>
              </Show>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
};

export default ProjectSettingsPage;
