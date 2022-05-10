import * as allExports from './index';

describe('exports', () => {
  test('has no default export', () => {
    expect.assertions(2);
    expect(allExports).toBeDefined();
    // @ts-expect-error - intentional access on undefined prop
    expect(allExports.default).toBeUndefined();
  });

  test('only exports "Status"', () => {
    expect.assertions(1);
    expect(Object.keys(allExports)).toEqual(['Status']);
  });
});

describe('Status enum', () => {
  test('has expected values', () => {
    expect.assertions(13);
    const { Status } = allExports;
    // @ts-expect-error - intentional invalid enum use
    expect(typeof Status).toBe('object');
    // @ts-expect-error - intentional invalid enum use
    expect(Object.keys(Status).length).toBeGreaterThan(120);
    // Check for most common status codes
    expect(Status.OK).toBe(200);
    expect(Status.NO_CONTENT).toBe(204);
    expect(Status.MOVED_PERMANENTLY).toBe(301);
    expect(Status.FOUND).toBe(302);
    expect(Status.BAD_REQUEST).toBe(400);
    expect(Status.UNAUTHORIZED).toBe(401);
    expect(Status.FORBIDDEN).toBe(403);
    expect(Status.NOT_FOUND).toBe(404);
    expect(Status.METHOD_NOT_ALLOWED).toBe(405);
    expect(Status.INTERNAL_SERVER_ERROR).toBe(500);
    expect(Status.SERVICE_UNAVAILABLE).toBe(503);
  });
});
