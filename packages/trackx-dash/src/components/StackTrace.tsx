import './StackTrace.xcss';

// import { IconChevronDown, IconExternalLink } from '@trackx/icons';
import { IconChevronDown } from '@trackx/icons';
import { createSignal, type Component } from 'solid-js';
import { For, Show } from 'solid-js/web';
// import { isValidURL } from '../utils';

// TODO: Types like this which are shared across packages should be in one
// place, a type source of truth to make sure they're up-to-date
interface StackFrameProps {
  file: string;
  line: number;
  column: number;
  callee: string;
  fileRelative?: string;
  start?: number;
  offset?: number;
  source?: string[];
  /** Frame is from internal source and should be hidden by default. */
  hide?: boolean;
  startExpanded: boolean;
}

// TODO: Internal frames should be easily distinguishable in the UI, ideally
// with a notice to explain what it is

export const StackFrame: Component<StackFrameProps> = (props) => {
  const [expanded, setExpanded] = createSignal(
    props.source && !props.hide && props.startExpanded,
  );

  return (
    <li class="frame">
      <div class="frame-meta dfc">
        <div>
          {props.file ? (
            <span title={props.file} class="break">
              {props.fileRelative || props.file}
              {/* TODO: Keep this? Much of the time the URL is valid but it's
              to a source file which wouldn't actually be there in a deployed
              app. The link icon can also be visually jarring. */}
              {/* {isValidURL(props.file) && (
                <a href={file}>
                  {' '}
                  <IconExternalLink />
                </a>
              )} */}
            </span>
          ) : (
            <span class="muted">{'<anonymous>'}</span>
          )}
          {props.callee && (
            <>
              <span class="muted"> in </span> {props.callee}
            </>
          )}
          {props.line && (
            <>
              <span class="muted"> at line </span>
              {props.line}:{props.column}
            </>
          )}
        </div>
        <button
          class={`button button-expand ml-auto${expanded() ? ' expanded' : ''}`}
          title="Expand/collapse stack frame"
          disabled={!props.source}
          onClick={() => setExpanded(!expanded())}
        >
          <IconChevronDown />
        </button>
      </div>
      {props.source && (
        <Show when={expanded()}>
          {/*
          // @ts-expect-error - FIXME! */}
          <ol class="frame-code code" start={props.start}>
            <For each={props.source}>
              {(sourceLine, index) => (
                <li
                  class={index() === props.offset ? 'error-line' : ''}
                  textContent={sourceLine}
                />
              )}
            </For>
          </ol>
        </Show>
      )}
    </li>
  );
};

export interface StackTraceProps {
  stack: Array<Omit<StackFrameProps, 'startExpanded'>>;
}

// TODO: Add a way to collapse/expand all the stack's frames

export const StackTrace: Component<StackTraceProps> = (props) => (
  <ul class="stack mh-3">
    <For each={props.stack}>
      {(frame, index) => <StackFrame {...frame} startExpanded={index() < 5} />}
    </For>
  </ul>
);
