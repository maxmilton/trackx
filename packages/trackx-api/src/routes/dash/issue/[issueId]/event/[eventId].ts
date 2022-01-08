import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../../../../db';
import type { Event, ReqQueryData } from '../../../../../types';
import {
  AppError,
  byteSize,
  humanFileSize,
  logger,
  Status,
} from '../../../../../utils';

const VALID_DIR_VALUES = ['first', 'prev', 'next', 'last'];

const getIssueEventFirstStmt = db.prepare(`
  SELECT id, ts, type, data, 1 AS is_first
  FROM event
  WHERE issue_id = @issueId
  ORDER BY id
  LIMIT 1
`);
const getIssueEventPrevStmt = db.prepare(`
  SELECT
    id,
    ts,
    type,
    data,
    (SELECT id FROM event WHERE issue_id = @issueId ORDER BY id LIMIT 1) = id AS is_first
  FROM event
  WHERE issue_id = @issueId AND id < @eventId
  ORDER BY id DESC
  LIMIT 1
`);
const getIssueEventNextStmt = db.prepare(`
  SELECT
    id,
    ts,
    type,
    data,
    (SELECT id FROM event WHERE issue_id = @issueId ORDER BY id DESC LIMIT 1) = id AS is_last
  FROM event
  WHERE issue_id = @issueId AND id > @eventId
  ORDER BY id
  LIMIT 1
`);
const getIssueEventLastStmt = db.prepare(`
  SELECT
    id,
    ts,
    type,
    data,
    (SELECT id FROM event WHERE issue_id = @issueId ORDER BY id LIMIT 1) = id AS is_first,
    1 AS is_last
  FROM event
  WHERE issue_id = @issueId
  ORDER BY id DESC
  LIMIT 1
`);
const getIssueEventStmt = db.prepare(`
  SELECT
    id,
    ts,
    type,
    data,
    (SELECT id FROM event WHERE issue_id = @issueId ORDER BY id LIMIT 1) = id AS is_first,
    (SELECT id FROM event WHERE issue_id = @issueId ORDER BY id DESC LIMIT 1) = id AS is_last
  FROM event
  WHERE issue_id = @issueId AND id = @eventId
`);

function getIssueEvent(
  issueId: string,
  eventId: string | undefined,
  dir: string | undefined,
): Event {
  let event: Event;

  switch (dir) {
    case 'first':
      event = getIssueEventFirstStmt.get({ issueId });
      break;
    case 'prev':
      event = getIssueEventPrevStmt.get({ issueId, eventId });
      break;
    case 'next':
      event = getIssueEventNextStmt.get({ issueId, eventId });
      break;
    case 'last':
      event = getIssueEventLastStmt.get({ issueId });
      break;
    case undefined:
      event = getIssueEventStmt.get({ issueId, eventId });
      break;
    default:
      throw new AppError('Invalid dir', Status.UNPROCESSABLE_ENTITY);
  }

  if (!event) {
    throw new AppError('Event not found', Status.NOT_FOUND);
  }

  // @ts-expect-error - stored as string in DB
  event.data = JSON.parse(event.data);

  // eslint-disable-next-line no-underscore-dangle
  (event.data.meta ??= {})._size = humanFileSize(byteSize(event));

  return event;
}

export const get: Middleware = (req, res, next) => {
  try {
    const { issueId, eventId } = req.params;

    if (issueId.length > 9 || !Number.isInteger(+issueId) || +issueId < 1) {
      throw new AppError('Invalid id', Status.UNPROCESSABLE_ENTITY);
    }

    if (
      typeof eventId !== 'string'
      || (eventId !== 'null'
        && (eventId.length > 11 // < 100 billion
          || !Number.isInteger(+eventId)
          || +eventId < 1))
    ) {
      throw new AppError('Invalid event', Status.UNPROCESSABLE_ENTITY);
    }

    const { dir, ...rest } = req.query as ReqQueryData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    if (dir !== undefined) {
      if (typeof dir !== 'string' || !VALID_DIR_VALUES.includes(dir)) {
        throw new AppError('Invalid dir', Status.UNPROCESSABLE_ENTITY);
      }
    }

    if (eventId === 'null') {
      if (dir === undefined) {
        throw new AppError(
          'Param event and/or dir required',
          Status.UNPROCESSABLE_ENTITY,
        );
      }
      if (dir !== 'first' && dir !== 'last') {
        throw new AppError('Invalid event ID', Status.UNPROCESSABLE_ENTITY);
      }
    }

    const data = getIssueEvent(issueId, eventId, dir);
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
