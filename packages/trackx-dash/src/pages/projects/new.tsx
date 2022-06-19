// TODO: Better onboarding experience when creating a new project, after the
// user enter the require details, show how to install the trackx script on
// their web site or app
//  ↳ Also give details on how to set up CSP and other reporting
//  ↳ These details should also be available after new project setup is
//    complete too!

// TODO: Create a "tag input component" + use for allowed domains and tags
//  ↳ https://blueprintjs.com/docs/#core/components/tag-input
//  ↳ https://evergreen.segment.com/components/tag-input/

// TODO: Make sure the logic is the same as settings/edit project

// TODO: Reduce the duplication between new project and project settings

// TODO: Better errors for users e.g., "project with same name already exists"
// or better "project name X is not available"

// TODO: Add a warning when using '*' as an allowed origin
// TODO: If using '*' allowed origin, validate it's the only entry

import type { RouteComponent } from '@maxmilton/solid-router';
import { routeTo } from '@maxmilton/solid-router';
import { IconChevronRight } from '@trackx/icons';
import { createEffect, onError } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Show } from 'solid-js/web';
import { renderErrorAlert } from '../../components/ErrorAlert';
import { AppError, config, logout } from '../../utils';
import {
  dirty,
  FORBIDDEN_PROJECT_NAMES,
  isNotOrigin,
  validate,
  VALIDATION_ERROR,
} from '../../validation';

const NewProjectPage: RouteComponent = () => {
  const [state, setState] = createStore({
    error: null as unknown,
    validationError: null as unknown,
    disableSubmit: false,
    origin: '',
    name: '',
    scrape: true,
    tags: '',
  });
  let formRef: HTMLFormElement;

  onError((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    setState({ error });
  });

  createEffect(() => {
    document.title = 'New Project | TrackX';
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
          validationError: error,
          disableSubmit: false,
        });
      } else {
        // eslint-disable-next-line no-console
        console.error(error);
        setState({
          error,
          disableSubmit: false,
        });
      }
      return;
    }

    try {
      const res = await fetch(`${config.DASH_API_ENDPOINT}/project`, {
        method: 'POST',
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
      });

      if (!res.ok) {
        if (res.status === 401) {
          void logout();
          return;
        }

        throw new AppError(await res.text(), res.status);
      }

      await routeTo(`/projects/${state.name}/install`);
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
        <span class="text fwm">New</span>
      </div>

      <Show when={state.error} children={renderErrorAlert} />

      <h1>Create New Project</h1>

      <div class="card narrow">
        <form
          // @ts-expect-error - ref not actually used before define
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
            <small class="note">ASCII tag names seperated by comma ","</small>
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

          <Show when={state.validationError} children={renderErrorAlert} />

          <div class="mt4">
            <button
              type="submit"
              class="button button-primary mr3"
              disabled={state.disableSubmit}
            >
              Create project
            </button>
            <a href="/projects" class="button">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectPage;
