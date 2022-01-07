import type { Middleware } from 'polka';
import { db, deniedDash } from '../../../../db';
import type { ReqBodyData, ReqQueryData } from '../../../../types';
import { AppError, logger, Status } from '../../../../utils';

const setIssueIgnoreStmt = db.prepare(
  'UPDATE issue SET ignore = ? WHERE id = ?',
);

function setIssueIgnore(issueId: string, state: boolean) {
  return setIssueIgnoreStmt.run(state ? 1 : 0, issueId);
}

export const options: Middleware = (_req, res) => {
  res.writeHead(Status.NO_CONTENT, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST',
  });
  res.end();
};

export const post: Middleware = (req, res, next) => {
  try {
    const { issueId } = req.params;

    if (issueId.length > 9 || !Number.isInteger(+issueId) || +issueId < 1) {
      throw new AppError('Invalid id', Status.UNPROCESSABLE_ENTITY);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const { value, ...rest } = req.body as ReqBodyData;

    if (Object.keys(rest).length > 0) {
      throw new AppError('Unexpected property', Status.BAD_REQUEST);
    }

    if (value == null || typeof value !== 'boolean') {
      throw new AppError('Invalid value', Status.UNPROCESSABLE_ENTITY);
    }

    setIssueIgnore(issueId, value);
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
