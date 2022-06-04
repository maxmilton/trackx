import { createSignal, onCleanup, type Component } from 'solid-js';

interface LoadingProperties {
  /**
   * Time in milliseconds for how long to wait before showing the loading
   * spinner. Prevents users from seeing a flash of the loading spinner when
   * the load time is very fast e.g, when loading a page route from memory.
   *
   * @default 176
   */
  delay?: number;
}

export const Loading: Component<LoadingProperties> = (props) => {
  const [show, setShow] = createSignal(false);
  const timer = window.setTimeout(() => {
    setShow(true);
  }, props.delay || 176);

  onCleanup(() => window.clearTimeout(timer));

  // TODO: Ideally this component would not render at all (keeping the previous
  // DOM) until ready, instead right now it renders nothing (e.g., removes
  // <Suspend> etc. content DOM) but it would be great if it would not render
  // until ready triggers and then render the div.spinner-wrapper
  return (
    <>
      {show() && (
        <div class="spinner-wrapper pa4">
          <div class="spinner" />
        </div>
      )}
    </>
  );
};
