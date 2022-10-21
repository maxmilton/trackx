/**
 * TrackX Browser Info Plugin
 *
 * @see https://docs.trackx.app/#/guides/tracking-errors.md#plugins-browser
 */

// WARNING: This file is experimental and may be removed in the future!!!

/* eslint-disable unicorn/no-nested-ternary */

import type { OnErrorHandler } from 'trackx/types';

export const screenSize = (): string => {
  const screenWidth = globalThis.screen.width;
  return screenWidth < 576
    ? 'XS'
    : screenWidth < 992
      ? 'S'
      : screenWidth < 1440
        ? 'M'
        : screenWidth < 3840
          ? 'L'
          : 'XL';
};

export const embedded = (): string => {
  try {
    const frame = globalThis.frameElement;
    return (frame && frame.nodeName) || '';
  } catch (_error) {
    // Catch SecurityError when parent is cross-origin
    return 'cross-origin';
  }
};

export const ancestors = (): string[] => {
  const ancestorList = globalThis.location.ancestorOrigins;
  return (ancestorList && ancestorList.length > 0 && [...ancestorList]) || [];
};

export const auto: OnErrorHandler = (payload) => {
  if (!('screenSize' in payload.meta)) {
    // eslint-disable-next-line no-param-reassign
    payload.meta.screenSize = screenSize();
  }
  if (!('embedded' in payload.meta)) {
    // eslint-disable-next-line no-param-reassign
    payload.meta.embedded = embedded();
  }
  if (!('ancestors' in payload.meta)) {
    // eslint-disable-next-line no-param-reassign
    payload.meta.ancestors = ancestors();
  }
  return payload;
};
