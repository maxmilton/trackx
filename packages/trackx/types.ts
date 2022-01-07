export const enum EventType {
  UnhandledError = 1,
  UnhandledRejection = 2,
  ConsoleError = 3,
  /** Event sent via programmatic use of client `trackx.sendEvent()`. */
  Programmatic = 4,
  /** Content Security Policy Report. */
  CSPReport = 5,
  DeprecationReport = 6,
  InterventionReport = 7,
  CrashReport = 8,
  /** Certificate Transparency Report. */
  CTReport = 9,
  /** Network Error Logging Report. */
  NELReport = 10,
  CustomLogger = 70,
  Custom1 = 71,
  Custom2 = 72,
  Custom3 = 73,
  UnknownReport = 96,
  UnknownEvent = 97,
  Unknown = 98,
  Test = 99,
}

export const enum ClientType {
  Default = 'd',
  Lite = 'l',
  Modern = 'm',
  Extended = 'e',
  Compat = 'c',
  Node = 'n',
  Custom = '_',
}

export interface EventMeta {
  /** @remarks Keys with a leading underscore are reserved for internal use. */
  [key: string]: unknown;

  /** TrackX client type. */
  readonly _c?: ClientType;
  /** TrackX client version. */
  readonly _v?: string | undefined;
}

export interface EventPayload {
  name?: string | undefined;
  message: string;
  stack?: string | undefined;
  type: EventType;
  uri?: string | undefined;
  meta: EventMeta;
}

/**
 * Callback function that is called every time an event is sent. Can mutate the
 * payload data or prevent sending the event.
 *
 * @returns Return a falsely value to cancel sending otherwise an EventPayload.
 */
export type OnErrorHandler = (
  payload: EventPayload,
  reason: unknown,
) => EventPayload | false | undefined | null | void;
