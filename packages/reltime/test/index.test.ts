import reltime, * as allExports from '../src/index';

const TARGET = 'Sun Jun 14 2015 15:12:05 GMT-0700';

beforeAll(() => {
  global.Date.now = jest.fn(() => new Date(TARGET).getTime());
});

afterAll(() => {
  (global.Date.now as jest.Mock).mockRestore();
});

describe('exports', () => {
  test('has default export', () => {
    expect.assertions(2);
    expect(allExports).toBeDefined();
    expect(allExports.default).toBeDefined();
  });

  test('only exports default function', () => {
    expect.assertions(1);
    expect(Object.keys(allExports)).toEqual(['default']);
  });

  test('default export is a function', () => {
    expect.assertions(1);
    expect(typeof allExports.default).toBe('function');
  });
});

test('mocked implementation of Date.now works', () => {
  expect.assertions(1);
  expect(Date.now()).toBe(new Date(TARGET).getTime());
});

describe('option short = undefined (defaults to 1)', () => {
  test.each([
    ['12/31/2013', '1 year ago'],
    ['2030-05-20', '14 years from now'],
    ['2030-05-20 14:02:47', '14 years from now'],
    ['Wed, 20 Nov 1912 00:00:00 GMT', '102 years ago'],
    ['Sun Jun 14 2015 15:13:00 GMT-0700', 'just now'],
    [TARGET, 'just now'],
  ])('default options for %s', (date, expected) => {
    expect.assertions(1);
    expect(reltime(date)).toBe(expected);
  });

  test.each([
    ['12/31/2013', '1 year, 5 months ago'],
    ['2030-05-20', '14 years, 11 months from now'],
    ['2030-05-20 14:02:47', '14 years, 11 months from now'],
    ['Wed, 20 Nov 1912 00:00:00 GMT', '102 years, 7 months ago'],
    ['Sun Jun 14 2015 15:13:00 GMT-0700', 'just now'],
    [TARGET, 'just now'],
  ])('maxPeriods = 2 for %s', (date, expected) => {
    expect.assertions(1);
    expect(reltime(date, undefined, 2)).toBe(expected);
  });

  test.each([
    ['12/31/2013', '1 year, 5 months, 21 days, 8 hours, 12 minutes ago'],
    ['2030-05-20', '14 years, 11 months, 23 days, 1 hour, 47 minutes from now'],
    ['2030-05-20 14:02:47', '14 years, 11 months, 23 days, 5 hours, 50 minutes from now'],
    ['Wed, 20 Nov 1912 00:00:00 GMT', '102 years, 7 months, 21 days, 22 hours, 12 minutes ago'],
    ['Sun Jun 14 2015 15:13:00 GMT-0700', 'just now'],
    [TARGET, 'just now'],
  ])('maxPeriods >= 5 for %s', (date, expected) => {
    expect.assertions(2);
    expect(reltime(date, undefined, 5)).toBe(expected);
    expect(reltime(date, undefined, 100)).toBe(expected);
  });
});

describe('option short = true', () => {
  test.each([
    ['12/31/2013', '1y ago'],
    ['2030-05-20', '14y from now'],
    ['2030-05-20 14:02:47', '14y from now'],
    ['Wed, 20 Nov 1912 00:00:00 GMT', '102y ago'],
    ['Sun Jun 14 2015 15:13:00 GMT-0700', 'just now'],
    [TARGET, 'just now'],
  ])('maxPeriods = undefined for %s', (date, expected) => {
    expect.assertions(1);
    expect(reltime(date, true)).toBe(expected);
  });

  test.each([
    ['12/31/2013', '1y, 5mo ago'],
    ['2030-05-20', '14y, 11mo from now'],
    ['2030-05-20 14:02:47', '14y, 11mo from now'],
    ['Wed, 20 Nov 1912 00:00:00 GMT', '102y, 7mo ago'],
    ['Sun Jun 14 2015 15:13:00 GMT-0700', 'just now'],
    [TARGET, 'just now'],
  ])('maxPeriods = 2 for %s', (date, expected) => {
    expect.assertions(1);
    expect(reltime(date, true, 2)).toBe(expected);
  });

  test.each([
    ['12/31/2013', '1y, 5mo, 21d, 8h, 12m ago'],
    ['2030-05-20', '14y, 11mo, 23d, 1h, 47m from now'],
    ['2030-05-20 14:02:47', '14y, 11mo, 23d, 5h, 50m from now'],
    ['Wed, 20 Nov 1912 00:00:00 GMT', '102y, 7mo, 21d, 22h, 12m ago'],
    ['Sun Jun 14 2015 15:13:00 GMT-0700', 'just now'],
    [TARGET, 'just now'],
  ])('maxPeriods >= 5 for %s', (date, expected) => {
    expect.assertions(2);
    expect(reltime(date, true, 5)).toBe(expected);
    expect(reltime(date, true, 100)).toBe(expected);
  });
});
