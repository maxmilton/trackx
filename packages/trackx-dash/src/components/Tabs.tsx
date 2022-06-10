import './Tabs.xcss';

import {
  createSignal,
  type Accessor,
  type Component,
  type JSX,
  type Setter,
} from 'solid-js';
import { Match, Switch } from 'solid-js/web';

interface TabsProps {
  children: JSX.Element[];
  titles: string[];
  /**
   * To change the current tab on multiple instances of Tabs, pass in a shared
   * signal to each instance. The value should be a number e.g., `0`.
   *
   * @example
   * const sharedTabSignal = createSignal(0)
   * ...
   * <Tabs ... signal={sharedTabSignal}>
   */
  signal?: [get: Accessor<number>, set: Setter<number>];
}

export const Tabs: Component<TabsProps> = (props) => {
  if (process.env.NODE_ENV !== 'production') {
    if (typeof props.children !== 'object' || !Array.isArray(props.children)) {
      throw new TypeError('Tabs expects multiple children');
    }

    if (props.titles.length !== props.children.length) {
      throw new Error(
        'Tabs number of titles is different from number of children',
      );
    }
  }

  const [currentTab, setCurrentTab] = props.signal || createSignal(0);

  return (
    <div class="tabs">
      <div role="tablist">
        {props.titles.map((title, index) => (
          <button
            role="tab"
            aria-selected={currentTab() === index}
            onClick={() => setCurrentTab(index)}
            textContent={title}
          />
        ))}
      </div>
      <div class="pa3" role="tabpanel">
        <Switch>
          {props.children.map((child, index) => (
            <Match when={currentTab() === index}>{child}</Match>
          ))}
        </Switch>
      </div>
    </div>
  );
};
