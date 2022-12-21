import './Graph.xcss';

import {
  createEffect,
  createResource,
  onCleanup,
  onMount,
  type Component,
} from 'solid-js';
import { Match, Switch } from 'solid-js/web';
import UPlot from 'uplot';
import type { TimeSeriesData } from '../../../trackx-api/src/types';
import { config, fetchJSON } from '../utils';
import { renderErrorAlert } from './ErrorAlert';
import { Loading } from './Loading';

type PartialLike<T> = {
  [P in keyof T]?: T[P] | undefined;
};

interface GraphProps {
  data: TimeSeriesData;
  opts?: PartialLike<UPlot.Options>;
  /** Dynamically set the y-axis label width. */
  yAuto?: boolean;
}

// TODO: Consider implementing custom graphing -- even though uplot is small in
// comparison to basically all other charting libraries, it also comes with
// bloat and itself makes up over 40% of our overall file size
//  ↳ uplot code is a great starting point, especially for tricky logic

export const Graph: Component<GraphProps> = (props) => {
  let ref: HTMLDivElement;
  let uplot: UPlot;

  createEffect(() => {
    if (uplot) {
      uplot.setData(props.data);
    } else {
      const defaultOpts: Partial<UPlot.Options> = {
        height: 300,
        tzDate: (ts) => UPlot.tzDate(new Date(ts * 1e3), 'Etc/UTC'),
        // Padding top prevents y-axis labels from being cut off and padding
        // right 10px offset + 1/2 point size to prevent points and date labels
        // from being cut off
        padding: [10, 20, 0, 0],
        cursor: {
          points: {
            size: 20,
            width: 5,
            // @ts-expect-error - _stroke is missing in upstream types
            // eslint-disable-next-line no-underscore-dangle
            stroke: (u, seriesIdx) => `${u.series[seriesIdx]._stroke}90`,
            // @ts-expect-error - _stroke is missing in upstream types
            // eslint-disable-next-line no-underscore-dangle
            fill: (u, seriesIdx) => u.series[seriesIdx]._stroke as string,
          },
        },
        // @ts-expect-error - FIXME:!
        select: {
          show: false,
        },
        scales: {
          x: {
            // Prevents extra ticks being added to the x-axis between dates
            distr: 2, // ordinal
          },
        },
        axes: [
          {
            stroke: '#8a9ba8', // gray3
            grid: {
              stroke: '#10161a40', // dark1 + 0.25 alpha
            },
          },
          {
            stroke: '#8a9ba8', // gray3
            grid: {
              stroke: '#10161a40', // dark1 + 0.25 alpha
            },
          },
        ],
      };
      const upOpts = UPlot.assign(
        defaultOpts,
        props.opts || {},
      ) as UPlot.Options;
      upOpts.width ??= ref.offsetWidth;
      if (props.yAuto) {
        upOpts.axes![1].size = (_u, values) => {
          if (values == null) return 40;
          const maxChars = values[values.length - 1].length;
          return Math.max(40, 10 * maxChars);
        };
      }
      uplot = new UPlot(upOpts, props.data, ref);
    }
  });

  const handleResize = () => {
    uplot.setSize({
      width: ref.offsetWidth,
      height: props.opts?.height || 300,
    });
  };
  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    if (!props.opts?.width) {
      if ('ResizeObserver' in window) {
        // Callback wrapped in rAF to prevent "ResizeObserver loop limit
        // exceeded" errors in chromium but can cause small delay in updates
        resizeObserver = new ResizeObserver(() => requestAnimationFrame(handleResize));
        resizeObserver.observe(ref);
      } else {
        // XXX: TypeScript incorrectly thinks window is not defined after the above check
        (window as Window).addEventListener('resize', handleResize);
      }
    }
  });
  onCleanup(() => {
    if (!props.opts?.width) {
      if (resizeObserver) {
        // TODO: Is this necessary for memory cleanup?
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', handleResize);
      }
    }
  });

  // @ts-expect-error - ref not actually used before define
  return <div ref={ref} class="graph"></div>;
};

interface SparklineProps {
  // type: 'event';
  period: '24h' | '30d';
  /** When type=event pass in an issue_id. */
  parent: string | number | bigint;
  width?: number | undefined;
  height?: number | undefined;
}

export const Sparkline: Component<SparklineProps> = (props) => {
  const [data] = createResource<TimeSeriesData, string>(
    () => `${config.DASH_API_ENDPOINT}/issue/${props.parent}/graph?period=${props.period}`,
    fetchJSON,
  );

  return (
    <Switch fallback={<p class="danger">Failed to load graph data</p>}>
      <Match when={data.error} children={renderErrorAlert} keyed />
      <Match when={data.loading}>
        <Loading />
      </Match>
      <Match when={data()} keyed>
        {(dataSet) => (
          <Graph
            data={dataSet}
            opts={{
              width: props.width,
              height: props.height || 100,
              axes: [
                {
                  show: false,
                  grid: {
                    show: false,
                  },
                },
                {
                  show: false,
                  grid: {
                    show: false,
                  },
                },
              ],
              cursor: {
                x: false,
                y: false,
                points: {
                  fill: '#d8e1e8', // light2
                  stroke: '#d8e1e859', // light2 + 0.35 alpha
                },
              },
              scales: {
                x: {
                  // Prevent bars being clipped at the end of the graph
                  range(u, min, max) {
                    const half = ((max - min) / u.data[0].length) * 0.5;
                    return [min - half, max + half];
                  },
                },
              },
              series: [
                {},
                {
                  label: 'Events',
                  width: 2,
                  stroke: '#2b95d6', // blue4
                  fill: '#2b95d61a', // blue4 + 0.1 alpha
                  pxAlign: false,
                  paths: UPlot.paths.bars!({
                    size: [1],
                    gap: 2,
                  }),
                  points: {
                    show: false,
                  },
                },
              ],
            }}
          />
        )}
      </Match>
    </Switch>
  );
};
