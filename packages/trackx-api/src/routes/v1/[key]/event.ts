import { parse, resetCache, StackFrame } from '@trackx/stack-trace-parser';
import { isIP } from 'net';
import type { Middleware } from 'polka';
import { EventType } from 'trackx/types';
import {
  addEventStmt,
  addIssueStmt,
  addSessionGraphHitStmt,
  addSessionIdxStmt,
  addSessionStmt,
  db,
  deniedEvent,
  existingSessionIdxStmt,
  existingSessionStmt,
  getDailySalt,
  getProjectByKeyStmt,
  incrementDailyEvents,
  matchingIssueHashStmt,
  updateIssueSessStmt,
  updateIssueStmt,
  updateSessionGraphStmt,
  updateSessionStmt,
} from '../../../db';
import type {
  EventInternal,
  IssueInternal,
  ProjectInternal,
  ReqBodyData,
  ReqQueryData,
  SessionInternal,
  StackFrame as EventStackFrame,
} from '../../../types';
import {
  AppError,
  byteSize,
  config,
  getIpAddress,
  hash,
  isNotASCII,
  logger,
  Status,
  uaParser,
  UID_SHORT_LENGTH,
} from '../../../utils';

type IncomingEvent = Pick<EventInternal, 'type'> & {
  data: Omit<EventInternal['data'], 'name'> & {
    name: string | undefined;
    stack: string | undefined;
  };
};

// TODO: Rewrite the entire ingest pipeline as it was just hacked together
//  ↳ Plan out properly with a flow diagram etc.
//  ↳ Rewrite with memory footprint and efficiency in mind, same for stack parser

export function addEvent(
  key: string,
  origin: string,
  ip: string,
  ua: string,
  payload: IncomingEvent,
): void {
  const project = getProjectByKeyStmt.get(key) as ProjectInternal | undefined;

  if (!project) {
    throw new AppError('Invalid key', Status.FORBIDDEN);
  }

  if (!project.origin.split(',').includes(origin) && project.origin !== '*') {
    throw new AppError('Invalid origin', Status.FORBIDDEN);
  }

  void (async () => {
    const parser = uaParser.setUA(ua);
    const uaBrowser = parser.getBrowser();
    const uaOs = parser.getOS();

    // TODO: Think about better fallback values for missing data (either entered
    // now maybe even better to do so when the data is retrieved?)
    const eventData: Omit<EventInternal, 'id'> = {
      project_id: project.id,
      // @ts-expect-error - set later
      issue_id: undefined,
      ts: Date.now(),
      type: payload.type,
      data: {
        // undefined set later when we have access to more data
        name: payload.data.name,
        message: payload.data.message,
        uri: payload.data.uri,
        stack: undefined, // set later if we have data
        stack_raw: payload.data.stack_raw,
        os: uaOs.name,
        os_v: uaOs.version,
        agent: uaBrowser.name,
        agent_v: uaBrowser.version,
        meta: payload.data.meta,
      },
    };

    let stack: StackFrame[] = [];

    try {
      stack = parse.raw({
        name: eventData.data.name,
        message: eventData.data.message,
        stack: eventData.data.stack_raw,
        // @ts-expect-error - FIXME:!
        url: eventData.data.uri,
      });
    } catch (error) {
      logger.error(error);
    }

    if (stack.length > config.MAX_STACK_FRAMES) {
      stack.length = config.MAX_STACK_FRAMES;
    }

    if (project.scrape && stack.length > 0) {
      try {
        // TODO: Build network retry and timeout options into parser
        stack = await parse.withSource(stack);

        // TODO: Build much better cache logic and controls into parser net code
        //  ↳ We need fetched resources to be as fresh as possible but also
        //    to reduce latency and network cost, plus reduce system resource
        //    requirements overall
        //  ↳ If implementing an on-disk cache, it would be cool to have a
        //    way to prime the cache for projects; maybe find some
        //    inspiration in sentry's "releases" feature -- would be useful
        //    for projects which are behind private networks too
        //  ↳ Within the same stack parse pass, definitely cache in memory to
        //    ensure all frames refer to the same file contents
        //    ↳ This cache should _probably_ be for the individual stack only

        // TODO: Cache control should be in the parser so remove resetCache here
        //  ↳ Especially since resetCache here runs after an async call which
        //    means it could potencially be run while another request's stack
        //    parsing is in progress!

        // TODO: Correctly handle inline source maps with various encoding and
        // edge cases like multiple source map comments

        // Purge cache so fetched sources are fresh for next event
        resetCache();
      } catch (error) {
        logger.error(error);
      }
    }

    // TODO: Deal with the filtered frames still in the original raw stack trace
    //  ↳ Maybe keep the filtered frames but just minimise them by default?
    //  ↳ Could also keep + minimise + add a notice/icon in the UI
    //  ↳ Another option is to remove from the raw stack... but it doesn't feel
    //    right since that's obfuscating what's really happening
    //  ↳ Either way the "client internal" frames should not count towards
    //    uniqueness in the fingerprint -- that's what's important

    // FIXME: This doesn't actually match for all expected scenarios:
    // 1. "trackx-magnet" browser extension (but ideally not others!)
    // 2. "trackx" client when installed as an NPM module
    // 3. CDN hosted trackx client scripts
    // 4. "trackx" client on apps within this monorepo

    // FIXME: Doesn't work for the newer "trackx-magnet" browser extension
    // implementation which injects a script tag with text (so loc is anonymous)

    // Filter out frames which originate in a trackx client or a browser
    // extension (like trackx-magnet) -- helps avoid situations where the trace
    // is "synthetic" e.g., the original exception didn't have an ex.stack
    // property and the client generated one with new Error().stack
    stack = stack.map((frame) => {
      if (
        ((frame.file.startsWith('chrome-extension://')
          || frame.file.startsWith('moz-extension://'))
          && frame.fileName === 'trackx.js')
        // || frame.file.includes('node_modules/trackx/')
        || /trackx(?:@\w+)?\/(?:compat|default|extended|lite|modern|node)\.m?js$/.test(
          frame.file,
        )
      ) {
        // TODO: Don't use the .hide property? Use a better naming convention
        // once we do the stack parser rewrite
        // eslint-disable-next-line no-param-reassign
        frame.hide = true;
      }

      return frame;
    });

    // // TODO: Derive name based on some kind of heuristics using known data
    // // points e.g. event type, message, stack data, etc.
    // //  ↳ When rewriting the stack parser include name + message extraction
    // //  ↳ If we can't extract the name and message then keep NULL and fall
    // //    back to "Error" on the frontend
    // if (!eventData.data.name) {
    //   eventData.data.name = eventType[eventData.type];
    // }

    const remappedStack = stack.map((frame) => {
      const newFrame: EventStackFrame = {
        file: frame.file,
        line: frame.line,
        column: frame.column,
        callee: frame.calleeShort,
        fileRelative: frame.fileRelative,
        hide: frame.hide,
      };

      // Trim source code to the error line + up to 5 lines before and 5 lines after
      if (frame.sourceFile) {
        let start = frame.line! - 6;
        let offset = 5;

        if (frame.line! < 6) {
          start = 0;
          offset = frame.line! - 1;
        }

        newFrame.start = frame.line! - offset;
        newFrame.offset = offset;
        newFrame.source = frame.sourceFile.lines.slice(start, start + 11);
      }

      return newFrame;
    });

    if (remappedStack.length > 0) {
      eventData.data.stack = remappedStack;
    }

    let payloadBytes = byteSize(eventData);

    if (eventData.data.stack && payloadBytes > config.MAX_EVENT_BYTES) {
      // TODO: Normally the higher frames are the most relevant, so it would be
      // better to remove the source code from the last N frames only until the
      // payload size is below the limit

      // Strip out source code to reduce size -- better to have frames without
      // source than completely discard the event
      eventData.data.stack = eventData.data.stack.map((frame) => ({
        file: frame.file,
        line: frame.line,
        column: frame.column,
        callee: frame.callee,
        fileRelative: frame.fileRelative!,
      }));
      // eslint-disable-next-line no-underscore-dangle
      (eventData.data.meta ??= {})._oversize = true;

      payloadBytes = byteSize(eventData);
    }
    if (payloadBytes > config.MAX_EVENT_BYTES) {
      logger.warn('Event size exceeds byte limit');
      deniedEvent(key);
      return;
    }

    // TODO: Continue to improve the grouping logic
    //  ↳ https://docs.sentry.io/product/sentry-basics/grouping-and-fingerprints/
    //  ↳ https://docs.sentry.io/product/data-management-settings/event-grouping/
    //  ↳ https://docs.sentry.io/product/data-management-settings/event-grouping/grouping-breakdown/
    //  ↳ Sentry have some interesting ideas about grouping on partial stack
    //  ↳ Find more open source project with robust grouping logic

    // TODO: Fingerprinting should attempt to normalise cache busting hashes in
    // filenames -- probably something that should be done in the parser

    // TODO: Normalise "eventData.data.message"; it can be different across
    // browsers even for the same exception

    const normalisedStack = stack
      .filter((frame) => !frame.hide)
      .map(
        (frame) => `${frame.callee}@${frame.file}:${frame.line}:${frame.column}`,
      );
    const fingerprint = normalisedStack.length > 0
      ? `${eventData.project_id}:${normalisedStack.join('\n')}`
      : `${eventData.project_id}:${eventData.type}:${eventData.data.name}:${eventData.data.message}`;
    const fingerprintHash = hash(Buffer.from(fingerprint));

    db.transaction(() => {
      const existingIssue = matchingIssueHashStmt.get(fingerprintHash);

      if (existingIssue?.ignore) return;

      const salt = getDailySalt();
      const sessionId = hash(Buffer.from(salt + origin + ip + ua));
      const existingSession = existingSessionStmt.get(sessionId, project.id);

      if (existingIssue) {
        eventData.issue_id = existingIssue.id;

        const existingSessionIdx = existingSessionIdxStmt.get(
          sessionId,
          eventData.issue_id,
        );

        if (!existingSession) {
          const sessionData: SessionInternal = {
            id: sessionId,
            project_id: project.id,
            ts: Math.trunc(eventData.ts / 1000),
            e: 1,
          };
          addSessionStmt.run(sessionData);
          addSessionGraphHitStmt.run(sessionData);
        } else if (existingSession.e === 0) {
          updateSessionStmt.run(sessionId, project.id);
          updateSessionGraphStmt.run(project.id, existingSession.ts);
        }

        if (!existingSessionIdx) {
          addSessionIdxStmt.run(sessionId, existingIssue.id);
          updateIssueSessStmt.run(existingIssue.id);
        }

        updateIssueStmt.run(eventData.ts, existingIssue.id);
      } else {
        // FIXME: This should be smarter or at least more robust
        // TODO: Use eventData.offset
        // TODO: Move into its own util function
        // const loc = (() => {
        //   // XXX: The canonical location should be offset if the top of the stack
        //   // originates from the `trackx` client
        //   if (stack[0]) {
        //     // `trackx` client package overrides console.error so we don't want
        //     // that call location
        //     const offset = eventData.type === 2 ? 1 : 0;
        //     // FIXME: fileRelative is not guaranteed to exist since the frame might not exist!
        //     return stack[offset].fileRelative;
        //   }
        //   // TODO: Should the URL be used as the fallback event location origin?
        //   return eventData.uri;
        // })();

        // Create a new issue DB entry
        const issueData: Omit<
        IssueInternal,
        'id' | 'event_c' | 'ignore' | 'done'
        > = {
          hash: fingerprintHash,
          project_id: project.id,
          ts_last: eventData.ts,
          ts_first: eventData.ts,
          sess_c: 1,
          // FIXME: Values name and message should be a normalised/canonical
          // form possibly extracted from the stack or otherwise some value
          // which is the same or similar across browsers
          name: eventData.data.name,
          message: eventData.data.message,
          uri: eventData.data.uri,
        };
        const issue_id = addIssueStmt.run(issueData).lastInsertRowid;

        eventData.issue_id = issue_id as number;

        if (!existingSession) {
          const sessionData: SessionInternal = {
            id: sessionId,
            project_id: project.id,
            ts: Math.trunc(eventData.ts / 1000),
            e: 1,
          };
          addSessionStmt.run(sessionData);
          addSessionGraphHitStmt.run(sessionData);
        } else if (existingSession.e === 0) {
          updateSessionStmt.run(sessionId, project.id);
          updateSessionGraphStmt.run(project.id, existingSession.ts);
        }

        addSessionIdxStmt.run(sessionId, issue_id);
      }

      // @ts-expect-error - data stored as string in DB
      eventData.data = JSON.stringify(eventData.data);

      addEventStmt.run(eventData);

      incrementDailyEvents();
    })();
  })();
}

export const post: Middleware = (req, res, next) => {
  try {
    // eslint-disable-next-line prefer-destructuring
    const origin = req.headers.origin;

    if (!origin) {
      throw new AppError('Invalid origin', Status.FORBIDDEN);
    }

    const { key } = req.params;

    if (key.length !== UID_SHORT_LENGTH || !/^[\da-z]+$/.test(key)) {
      throw new AppError('Invalid key', Status.FORBIDDEN);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const {
      name, message, type, uri, stack, meta, ...rest
    } = req.body as ReqBodyData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected property', Status.BAD_REQUEST);
    }

    // TODO: Should MAX_ERROR_NAME_CHARS and MAX_ERROR_MESSAGE_CHARS be configurable values?

    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 512) {
        throw new AppError('Invalid name', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (message !== undefined) {
      if (typeof message !== 'string' || message.length > 10_000) {
        throw new AppError('Invalid message', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (type !== undefined) {
      if (typeof type !== 'number' || type < 0 || type > 99) {
        throw new AppError('Invalid type', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (uri !== undefined) {
      if (typeof uri !== 'string' || uri.length > config.MAX_URI_CHARS) {
        throw new AppError('Invalid uri', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (stack !== undefined) {
      if (typeof stack !== 'string' || stack.length > config.MAX_STACK_CHARS) {
        throw new AppError('Invalid stack', Status.UNPROCESSABLE_ENTITY);
      }
    }

    // TODO: More/better validation of meta data
    // TODO: Should there be a separate config option rather than MAX_EVENT_BYTES?
    if (meta !== undefined) {
      if (
        Object.prototype.toString.call(meta) !== '[object Object]'
        || JSON.stringify(meta).length > config.MAX_EVENT_BYTES
      ) {
        throw new AppError('Invalid meta', Status.UNPROCESSABLE_ENTITY);
      }
    }

    const ip = getIpAddress(req);

    if (!ip || typeof ip !== 'string' || !isIP(ip)) {
      throw new AppError('Invalid IP', Status.BAD_REQUEST);
    }

    // TODO: Use a mix of sec-ch-ua* and user-agent headers to get browser and OS info

    const ua = req.headers['user-agent'];

    if (
      !ua
      || typeof ua !== 'string'
      || ua.length > config.MAX_UA_CHARS
      || isNotASCII(ua)
    ) {
      throw new AppError('Invalid user agent', Status.BAD_REQUEST);
    }

    const derivedUri = uri || req.headers.referer || origin;

    if (
      typeof derivedUri !== 'string'
      || derivedUri.length > config.MAX_URI_CHARS
    ) {
      throw new AppError('Invalid uri, referer, or origin', Status.BAD_REQUEST);
    }

    addEvent(key, origin, ip, ua, {
      type: type ?? EventType.UnknownEvent,
      data: {
        name,
        message,
        stack: undefined, // set later if we have data
        stack_raw: stack,
        uri: derivedUri,
        // @ts-expect-error - FIXME: Better checks on meta to narrow down the type
        meta,
      },
    });

    res.writeHead(Status.OK, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: 0,
    });
    res.end('ok');
  } catch (error) {
    // DO NOT logger.error here otherwise it may cause an infinite loop
    logger.warn(error);
    void next(error || new Error(error));

    const projectKey = req.params.key;

    deniedEvent(
      projectKey.length === UID_SHORT_LENGTH && /^[\da-z]+$/.test(projectKey)
        ? projectKey
        : 'invalid',
    );
  }
};
