import send from '@polka/send';
import type { Middleware } from 'polka';
import { db, deniedDash } from '../../../../db';
import type { Issue, ReqBodyData, ReqQueryData } from '../../../../types';
import { AppError, logger, Status } from '../../../../utils';

const getIssueStmt = db.prepare(`
  SELECT
    id,
    ts_last,
    ts_first,
    event_c,
    sess_c,
    ignore,
    done,
    name,
    message,
    uri,
    (SELECT name FROM project WHERE project.id = issue.project_id) AS project_name
  FROM issue
  WHERE id = ?
`);
const delIssueStmt = db.prepare('DELETE FROM issue WHERE id = ?');

function getIssue(issue_id: string): Issue {
  const issue: Issue = getIssueStmt.get(issue_id) as Issue;

  if (!issue) {
    throw new AppError('Issue not found', Status.NOT_FOUND);
  }

  return issue;
}

function delIssue(issueId: string): void {
  const issue = getIssueStmt.get(issueId);

  if (!issue) {
    throw new AppError('Issue not found', Status.NOT_FOUND);
  }

  const result = delIssueStmt.run(issueId);

  if (result.changes < 1) {
    throw new AppError('No change', Status.INTERNAL_SERVER_ERROR);
  }
}

export const get: Middleware = (req, res, next) => {
  try {
    const { issueId } = req.params;

    if (issueId.length > 9 || !Number.isInteger(+issueId) || +issueId < 1) {
      throw new AppError('Invalid id', Status.UNPROCESSABLE_ENTITY);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const data = getIssue(issueId);
    send(res, Status.OK, data);
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};

export const del: Middleware = (req, res, next) => {
  try {
    const { issueId } = req.params;

    if (issueId.length > 9 || !Number.isInteger(+issueId) || +issueId < 1) {
      throw new AppError('Invalid id', Status.UNPROCESSABLE_ENTITY);
    }

    const query = req.query as ReqQueryData;

    if (Object.keys(query).length > 0) {
      throw new AppError('Unexpected param', Status.BAD_REQUEST);
    }

    const body = req.body as ReqBodyData;

    if (body !== undefined) {
      throw new AppError('Unexpected property', Status.BAD_REQUEST);
    }

    delIssue(issueId);
    res.end();
  } catch (error) {
    logger.error(error);
    void next(error || new Error(error));
    deniedDash();
  }
};
