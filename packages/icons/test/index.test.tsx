/** @jest-environment jsdom */

import type { JSX } from 'solid-js';
import { cleanup, render } from 'solid-testing-library';
import * as allExports from '../src/index';

const COMPONENT_NAMES = [
  'IconAlert',
  'IconCheck',
  'IconChevronDown',
  'IconChevronRight',
  'IconCopy',
  'IconDotsVertical',
  'IconExternalLink',
  'IconHelp',
  'IconSearch',
  'IconSkip',
  'IconTrash',
  'IconX',
] as const;

function slugify(str: string) {
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/^-/, '')
    .toLowerCase();
}

afterEach(cleanup);

test('has no default export', () => {
  expect.assertions(2);
  expect(allExports).toBeDefined();
  // @ts-expect-error - intentional access on undefined prop
  expect(allExports.default).toBeUndefined();
});

test('only exports expected values', () => {
  expect.assertions(1);
  expect(Object.keys(allExports)).toEqual(COMPONENT_NAMES);
});

test.each(COMPONENT_NAMES)('exports %s component', (componentName) => {
  expect.assertions(1);
  const Component = allExports[componentName] as () => JSX.Element;
  expect(typeof Component).toBe('function');
  // expect(component.name).toBe(componentName);
});

test.each(COMPONENT_NAMES)('%s component renders an SVG with expected class', (componentName) => {
  expect.assertions(3);
  const Component = allExports[componentName] as () => JSX.Element;
  const rendered = render(() => <Component />);
  expect(rendered.container.firstChild).not.toBeNull();
  expect(rendered.container.firstChild!.nodeName).toBe('svg');
  expect(rendered.container.firstChild).toHaveClass(`icon ${slugify(componentName)}`);
});
