// import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { createSignal, onCleanup, type Component } from 'solid-js';
// import { Show } from 'solid-js/web';

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

// FIXME: onMount seems to not fire when Loading is used in a Suspense fallback

// export const Loading: Component<LoadingProperties> = ({ delay = 176 }) => {
//   const [ready, setReady] = createSignal(false);
//   let timer: number;

//   onMount(() => {
//     timer = window.setTimeout(() => {
//       setReady(true);
//     }, delay);
//   });

//   onCleanup(() => window.clearTimeout(timer));

//   return (
//     <div class="spinner-wrapper pa4">
//       <Show when={ready()}>
//         <div class="spinner"></div>
//       </Show>
//     </div>
//   );
// };

export const Loading: Component<LoadingProperties> = (props) => {
  const [ready, setReady] = createSignal(false);
  const timer = window.setTimeout(() => {
    setReady(true);
  }, props.delay || 176);

  onCleanup(() => window.clearTimeout(timer));

  // TODO: Ideally this component would not render at all (keeping the previous
  // DOM) until ready, instead right now it renders nothing (e.g., removes
  // <Suspend> etc. content DOM) but it would be great if it would not render
  // until ready triggers and then render the div.spinner-wrapper
  return (
    // <Show when={ready()}>
    //   <div class="spinner-wrapper pa4">
    //     <div class="spinner"></div>
    //   </div>
    // </Show>
    <>
      {ready() && (
        <div class="spinner-wrapper pa4">
          <div class="spinner" />
        </div>
      )}
    </>
  );
};
