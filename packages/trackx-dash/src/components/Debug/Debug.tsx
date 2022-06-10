import './Debug.xcss';

import { onMount, type Component } from 'solid-js';
import { createStore } from 'solid-js/store';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    export interface ProcessEnv {
      XCSS_GLOBALS: {
        app: {
          media: Record<string, string>;
        };
        media: Record<string, string>;
      };
    }
  }
}

const xcssConfig = process.env.XCSS_GLOBALS;

const xsMedia = matchMedia(xcssConfig.app.media.xs);
const sMedia = matchMedia(
  // XXX: There is no media.s in the config, it's the implicit default
  xcssConfig.media.ns.replace('min', 'max').replace('.01', ''),
);
const nsMedia = matchMedia(xcssConfig.media.ns);
const mMedia = matchMedia(xcssConfig.media.m);
const lMedia = matchMedia(xcssConfig.media.l);

/**
 * Debug info to help with UI development.
 */
export const Debug: Component = () => {
  const [state, setState] = createStore({
    fps: 0,
    fontSize: '',
    vw: 0,
    vh: 0,
    cw: 0,
    ch: 0,
    xs: xsMedia.matches, // special case media size just for this app
    s: sMedia.matches,
    ns: nsMedia.matches,
    m: mMedia.matches,
    l: lMedia.matches,
    get vwem(): number {
      return Math.round(state.vw / Number.parseFloat(state.fontSize));
    },
    get vhem(): number {
      return Math.round(state.vh / Number.parseFloat(state.fontSize));
    },
  });

  function updateData() {
    setState({
      fontSize: getComputedStyle(document.body).fontSize,
      vw: window.innerWidth,
      vh: window.innerHeight,
      cw: document.documentElement.clientWidth,
      ch: document.documentElement.clientHeight,
    });
  }

  onMount(() => {
    updateData();

    window.addEventListener('resize', updateData);
    xsMedia.addListener((event) => setState({ xs: event.matches }));
    sMedia.addListener((event) => setState({ s: event.matches }));
    nsMedia.addListener((event) => setState({ ns: event.matches }));
    mMedia.addListener((event) => setState({ m: event.matches }));
    lMedia.addListener((event) => setState({ l: event.matches }));
  });

  return (
    <div id="debug" class="pos-f r0 b0 z-max hide-on-hover">
      <button
        class="debug-button mr1"
        tabIndex={-1}
        onClick={() => document.body.classList.toggle('debug-overlay-grid')}
      >
        GRID
      </button>
      <button
        class="debug-button mr1"
        tabIndex={-1}
        onClick={() => document.body.classList.toggle('debug-overlay-a11y')}
      >
        A11Y
      </button>
      <button
        class="debug-button"
        tabIndex={-1}
        onClick={() => {
          // @ts-expect-error - types not important here
          import('https://cdn.jsdelivr.net/npm/stats.js/+esm')
            .then(({ default: Stats }) => {
              const stats = new Stats();
              document.body.appendChild(stats.dom);

              function loop() {
                stats.update();
                requestAnimationFrame(loop);
              }

              loop();
            })
            .catch(console.error);
        }}
      >
        FPS
      </button>

      <div class="jank-grid mv1">
        <div>CPU</div>
        <div class="jank">
          <div id="jank-cpu"></div>
        </div>
        <div>GPU</div>
        <div class="jank">
          <div id="jank-gpu"></div>
        </div>
      </div>

      <dl class="dg ma0 mb2 pen">
        <dt>1em</dt>
        <dd>{state.fontSize}</dd>

        <dt>vp em</dt>
        <dd>
          {state.vwem} x {state.vhem}
        </dd>

        <dt>vp px</dt>
        <dd>
          {state.vw} x {state.vh}
        </dd>

        <dt>client</dt>
        <dd>
          {state.cw} x {state.ch}
        </dd>
      </dl>

      <span class={`media-indicator ${state.xs ? 'green5' : 'red5'}`}>xs</span>
      <span class={`media-indicator ${state.s ? 'green5' : 'red5'}`}>s</span>
      <span class={`media-indicator ${state.ns ? 'green5' : 'red5'}`}>ns</span>
      <span class={`media-indicator ${state.m ? 'green5' : 'red5'}`}>m</span>
      <span class={`media-indicator ${state.l ? 'green5' : 'red5'}`}>l</span>
    </div>
  );
};
