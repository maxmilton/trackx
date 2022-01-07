export const noop = (): void => {};

export const assign = <T, F>(to: T, from: F): T & F => {
  // @ts-expect-error - FIXME:!
  // eslint-disable-next-line guard-for-in, no-restricted-syntax, no-param-reassign
  for (const key in from) to[key] = from[key];
  return to as T & F;
};
