// eslint-disable-next-line max-len
/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-throw-literal, func-names, no-console, no-await-in-loop, no-plusplus, max-classes-per-file, jsx-a11y/anchor-is-valid, unicorn/error-message, unicorn/no-array-for-each */

import { createEffect, type Component } from 'solid-js';
import { createStore } from 'solid-js/store';
import { For } from 'solid-js/web';
import { Loading } from '../components/Loading';
import { adHocQuery, AppError, config } from '../utils';
import './test.xcss';

class CustomError extends Error {
  declare code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);

    this.name = 'CustomError';
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class CustomError2 extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomError2';
  }
}

declare class CustomError3 extends CustomError {
  constructor(message: string, code?: number);
}

// https://developer.mozilla.org/en-US/docs/web/javascript/reference/global_objects/error#es5_custom_error_object
// eslint-disable-next-line @typescript-eslint/no-redeclare
function CustomError3(this: Error, message: string, code?: number) {
  const instance = new Error(message) as Error & { code: number | undefined };
  instance.name = 'CustomError3';
  instance.code = code;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
  if (Error.captureStackTrace) {
    Error.captureStackTrace(instance, CustomError3);
  }
  return instance;
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
CustomError3.prototype = Object.create(Error.prototype, {
  constructor: {
    value: Error,
    enumerable: false,
    writable: true,
    configurable: true,
  },
});
if (Object.setPrototypeOf) {
  Object.setPrototypeOf(CustomError3, Error);
} else {
  // eslint-disable-next-line no-proto
  CustomError3.__proto__ = Error;
}

declare class CustomError4 extends CustomError {
  constructor(message: string, code?: number);
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
function CustomError4(this: Error, message: string) {
  this.name = 'CustomError4';
  this.message = message;
  this.stack = new Error().stack!;
}
CustomError4.prototype = new Error();

declare class CustomError5 extends Error {
  constructor(message: string);
}

// https://github.com/mozilla/rhino/issues/153#issuecomment-401499488
// eslint-disable-next-line @typescript-eslint/no-redeclare
function CustomError5(this: Error, message: string) {
  this.message = message;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, CustomError5);
  } else {
    try {
      throw new Error();
    } catch (error) {
      this.stack = error.stack || error.stacktrace;
    }
  }
}
CustomError5.prototype = Object.create(Error.prototype);
CustomError5.prototype.constructor = CustomError5;
// @ts-expect-error - ref code has strange name assignment
CustomError5.prototype.name = 'CustomError5';

function function3(callback: () => void) {
  callback();
}
function function2(callback: () => void) {
  function3(callback);
}
function function1(callback: () => void) {
  function2(callback);
}

function toLocalISODate(date: Date) {
  const local = new Date(date);
  local.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function sleep(ms = 15) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface TestPageState {
  status: string | number;
  active: boolean;
  customMsg: string;
  projects: { id: number; name: string }[] | undefined;
  mockProjectId: number | null;
  mockTimeFrom: string;
  mockTimeTo: string;
  mockIssueAmount: number;
  mockEventAmount: number;
  mockSessionAmount: number;
  showLoading: boolean;
}

export const TestPage: Component = () => {
  const date1 = new Date();
  const date2 = new Date(date1);
  const daysAgo = 7;
  date2.setUTCDate(date2.getUTCDate() - daysAgo);

  const [state, setState] = createStore<TestPageState>({
    status: 'Ready',
    active: false,
    customMsg: 'Custom error message',
    projects: undefined,
    mockProjectId: null,
    mockTimeFrom: toLocalISODate(date2),
    mockTimeTo: toLocalISODate(date1),
    mockIssueAmount: 100,
    mockEventAmount: 100,
    mockSessionAmount: 100,
    showLoading: false,
  });

  createEffect(() => {
    document.title = 'Test | TrackX';
  });

  return (
    <div class="con">
      <h1>Test Tools</h1>

      <div class="alert alert-success">
        <strong>TIP:</strong> Test API gateway flood protection request blocking
        via{' '}
        <a href="http://localhost:5000" class="code">
          localhost:5000
        </a>{' '}
        or bypass blocking via{' '}
        <a href="http://localhost:5001" class="code">
          localhost:5001
        </a>
        .
      </div>

      <ul>
        <li>
          <a href="#single-error">Single error</a>
        </li>
        <li>
          <a href="#bulk-errors">Bulk errors</a>
        </li>
        <li>
          <a href="#backend-errors">Backend errors</a>
        </li>
        <li>
          <a href="#send-ping">Send ping</a>
        </li>
        <li>
          <a href="#mock-project">Generate mock project</a>
        </li>
        <li>
          <a href="#mock-issue">Generate mock issue</a>
        </li>
        <li>
          <a href="#mock-event">Generate mock event</a>
        </li>
        <li>
          <a href="#mock-session">Generate mock session</a>
        </li>
        <li>
          <a href="#loading-spinner">Loading spinner</a>
        </li>
        <li>
          <a href="#colour-samples">Colour samples</a>
        </li>
        <li>
          <a href="#ui-components">UI components</a>
        </li>
      </ul>

      <hr />

      <h3 id="single-error">Single error</h3>

      <div class="mb3">
        <button
          id="btn-all-single"
          class="button button-primary"
          disabled={state.active}
          onClick={() => {
            document
              .querySelectorAll<HTMLButtonElement>('.button.js-single')
              .forEach((btn) => btn.click());
          }}
        >
          Run all single
        </button>
        <button
          class="button ml3"
          disabled={state.active}
          onClick={async () => {
            setState({ status: 'Running...' });

            const btn = document.getElementById(
              'btn-all-single',
            ) as HTMLButtonElement;
            let i = 50;
            while (btn && i--) {
              btn.click();
              await sleep(0);
            }

            setState({
              status: 'Done (expect network congestion until all events sent)',
            });
          }}
        >
          All single x50
        </button>
        <button
          class="button ml3"
          disabled={state.active}
          onClick={() => {
            setState({ active: true, status: 'Running...' });

            const btns = document.querySelectorAll<HTMLButtonElement>('.button.js-single');
            const queue: HTMLButtonElement[] = [];
            let i = 500;
            while (i--) queue.push(...btns);

            (function next() {
              setTimeout(() => {
                const btn = queue.pop();
                if (btn) {
                  btn.click();
                  next();
                } else if (queue.length === 0) {
                  setState({ active: false, status: 'Done!' });
                }
              }, 0);
            }());
          }}
        >
          All single x500
        </button>
      </div>

      <div class="grid ns-gx2">
        <button
          class="button js-single"
          onClick={() => {
            throw new Error('Test error');
          }}
        >
          Throw Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            throw new AppError('Test app error');
          }}
        >
          Throw AppError
        </button>
        <button
          class="button js-single"
          onClick={() => {
            throw 'string error';
          }}
        >
          Throw string
        </button>
        <button
          class="button js-single"
          onClick={() => {
            throw {};
          }}
        >
          Throw empty object
        </button>

        <button
          class="button js-single"
          onClick={() => {
            throw { test: true, xx: '??' };
          }}
        >
          Throw object
        </button>
        <button
          class="button js-single"
          onClick={() => {
            throw { message: "I'm an object", name: 'FakeError' };
          }}
        >
          Throw Error-like object
        </button>
        <button
          class="button js-single"
          onClick={() => {
            throw null;
          }}
        >
          Throw null
        </button>
        <button
          class="button js-single"
          onClick={() => {
            throw undefined;
          }}
        >
          Throw undefined
        </button>
        <button
          class="button js-single"
          onClick={() => {
            console.error('Test error');
          }}
        >
          Console error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            console.error('Multi', 'part', 2, { test: true }, [1, 2, 'test']);
          }}
        >
          Console error multi-part
        </button>
        <button
          class="button js-single"
          onClick={() => {
            console.error(new Error('Test error'));
          }}
        >
          Console error Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            console.error(new AppError('Test error'));
          }}
        >
          Console error AppError
        </button>
        <button
          class="button js-single"
          onClick={() => {
            console.error({ type: 'Test error' });
          }}
        >
          Console error object
        </button>
        <button
          class="button js-single"
          onClick={() => {
            console.error(null);
          }}
        >
          Console error null
        </button>
        <button
          class="button js-single"
          onClick={() => {
            console.error();
          }}
        >
          Console error void
        </button>
        <button
          class="button js-single"
          onClick={() => {
            // @ts-expect-error - Obviously not a real function
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            notAnActualFn();
          }}
        >
          Reference error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            fetch('http://example.com/404').catch(console.warn);
          }}
        >
          CSP connect-src violation
        </button>
        <button
          class="button js-single"
          // @ts-expect-error - Intentional
          onclick="alert('test')"
        >
          CSP script-src violation
        </button>
        <button
          class="button js-single"
          onClick={() => {
            fetch(`${config.DASH_API_ENDPOINT}/not-a-real-enpoint`);
          }}
        >
          Unhandled fetch reject
        </button>
        <button
          class="button js-single"
          onClick={() => {
            Promise.reject();
          }}
        >
          Unhandled promise reject empty
        </button>
        <button
          class="button js-single"
          onClick={() => {
            Promise.reject(new Error('Unhandled'));
          }}
        >
          Unhandled promise reject error
        </button>
        <button
          class="button js-single"
          // eslint-disable-next-line @typescript-eslint/require-await
          onClick={async () => {
            throw new Error('Async throw');
          }}
        >
          Unhandled async throw Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            setTimeout(() => {
              throw new Error('From setTimeout');
            }, 10);
          }}
        >
          Unhandled setTimeout throw Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            const intervalId = setInterval(() => {
              clearInterval(intervalId);
              throw new Error('From setInterval');
            }, 10);
          }}
        >
          Unhandled setInterval throw Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            // eslint-disable-next-line unicorn/consistent-function-scoping
            const level1 = () => {
              throw new Error('From within setTimeout nested');
            };

            const level2 = () => {
              setTimeout(() => {
                try {
                  level1();
                } catch (error: unknown) {
                  console.error(error);
                }
              }, 10);
            };

            (() => level2())();
          }}
        >
          Catch inside setTimeout nested
        </button>
        <button
          class="button js-single"
          onClick={() => {
            const test = {
              nestedError() {
                const messageText = 'Long stack';
                throw new CustomError(messageText, 500);
              },
            };
            (function namedFn() {
              (function () {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                function1(test.nestedError);
              }());
            }());
          }}
        >
          Long stack throw CustomError
        </button>
        <button
          class="button js-single"
          onClick={() => {
            // eslint-disable-next-line unicorn/consistent-function-scoping
            function twelve() {
              throw new Error('Very long stack');
            }
            function eleven() {
              twelve();
            }
            function ten() {
              eleven();
            }
            function nine() {
              ten();
            }
            function eight() {
              nine();
            }
            function seven() {
              eight();
            }
            function six() {
              seven();
            }
            function five() {
              six();
            }
            function four() {
              five();
            }
            function three() {
              four();
            }
            function two() {
              three();
            }
            function one() {
              two();
            }
            function main() {
              one();
            }
            main();
          }}
        >
          Very long stack throw Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            throw new CustomError(
              'Lorem ipsum dolor sit amet consectetur adipisicing elit. Atque iure eius quisquam reiciendis explicabo autem ipsa ratione ducimus, quae laudantium deleniti ipsum magnam unde veniam rerum laborum quia fugit dicta!',
              500,
            );
          }}
        >
          Long title throw CustomError
        </button>
        <button
          class="button js-single"
          onClick={() => {
            window.trackx?.sendEvent(new Error('Test error'));
          }}
        >
          sendEvent Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            window.trackx?.sendEvent(new CustomError('Custom sent error'));
          }}
        >
          sendEvent CustomError
        </button>
        <button
          class="button js-single"
          onClick={() => {
            // @ts-expect-error - intentionally passing wrong argument type
            window.trackx?.sendEvent('string message');
          }}
        >
          sendEvent string
        </button>

        <div class="ns-w2">
          <input
            type="text"
            class="input w100"
            value={state.customMsg}
            onInput={(event) => {
              setState({ customMsg: event.currentTarget.value });
            }}
          />
          <button
            class="button w100 js-single"
            onClick={() => {
              console.error(state.customMsg);
            }}
          >
            Console error /w custom msg
          </button>
        </div>
      </div>

      <hr class="ns-w2" />

      <h3 id="bulk-errors">Bulk errors</h3>

      <div class="grid ns-gx2">
        <button
          class="button"
          disabled={state.active}
          onClick={() => {
            setState({ active: true });

            const send = window.trackx?.sendEvent as (val?: any) => void;

            // eslint-disable-next-line unicorn/consistent-function-scoping
            function fn1() {
              return 'ALL the things!';
            }

            send('ALL the things!');
            send('👹👺💀👻👫👨‍👩‍👧‍👧👨‍👨‍👦👌🏿1️⃣');
            send(new Error('ALL the things!'));
            send(new Error('ALL the things!'));
            // eslint-disable-next-line unicorn/new-for-builtins
            send(Error('ALL the things!'));
            send(TypeError('ALL the things!'));
            send(new CustomError('ALL the things!'));
            send(new CustomError('ALL the things!', 123));
            send(new CustomError2('ALL the things!'));
            send(new CustomError3('ALL the things!'));
            send(new CustomError3('ALL the things!', 123));
            send(new CustomError4('ALL the things!'));
            send(new CustomError5('ALL the things!'));
            send(new AppError('ALL the things!'));
            send(new AppError('ALL the things!', 123, null));
            send(1);
            send(0);
            send(-1);
            // eslint-disable-next-line unicorn/prefer-number-properties
            send(Infinity);
            // eslint-disable-next-line unicorn/prefer-number-properties
            send(-Infinity);
            send(Number.MAX_SAFE_INTEGER);
            send(Number.MAX_SAFE_INTEGER + 1);
            send(Number.MAX_VALUE);
            send(BigInt(Number.MAX_SAFE_INTEGER + 1));
            send(BigInt(Number.MAX_VALUE));
            send(['ALL the things!']);
            send([1]);
            send([0]);
            send([-1]);
            send([1, 2, 3]);
            send([0, 1, 2, 3]);
            send([-1, -2, -3]);
            send(true);
            send(false);
            send(null);
            // eslint-disable-next-line unicorn/no-useless-undefined
            send(undefined);
            send();
            // eslint-disable-next-line unicorn/prefer-number-properties
            send(NaN);
            send(Number.NaN);
            send(new Date());
            send({});
            send({ message: 'ALL the things!' });
            send({ message: 'ALL the things!', name: 'ALL the things?' });
            send(() => 'ALL the things!');
            send(() => {});
            send(fn1);
            // eslint-disable-next-line prefer-arrow-callback
            send(function fn2() {
              return 'ALL the things!';
            });
            send(new Set(['ALL the things!']));
            send(new Map());
            send(/^ALL the things!$/g);
            // eslint-disable-next-line prefer-regex-literals
            send(new RegExp('^ALL the things!$', 'g'));
            send(new ArrayBuffer(8));
            send(new Int8Array([1, 2, 3]));
            send(new URL('https://fake.all-the-things.com'));
            send(new Promise(() => {}));
            send(Symbol('ALL the things!'));
            send(Symbol.for('ALL the things?'));
            send(new Proxy(send, {}));
            send(document.getElementById('app'));
            send(document.getElementsByClassName('button'));
            send(document.querySelectorAll('.button'));
            send(document.createElement('div'));
            send(document.createElement('template'));
            send(document.createTextNode('ALL the things!'));
            send(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
            send(HTMLElement);
            send(Element);
            send(Node);
            send(Error);
            send(Date);
            send(Promise);
            send(window.addEventListener);
            send(setTimeout);
            send(window);
            send(window.navigator);
            send(document);
            send(document.body);
            send(document.location);
            send(document.forms);
            send(document.fonts);
            send(document.createTreeWalker(document));

            setState({ active: false, status: 'Done!' });

            // @ts-expect-error - fake
            send(fakeUndefinedVar); // crashes the onClick handler
          }}
        >
          sendEvent ALL the things!
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true });

            for (let index = 0; index < 100; index++) {
              console.error('100 console errors');
              setState({ status: index });
              await sleep();
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          100 console errors
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true });

            const min = 1;
            const max = 10;

            for (let index = 0; index < 100; index++) {
              const number = Math.floor(Math.random() * (max - min) + min);
              console.error(`100 console #${number}`);
              setState({ status: index });
              await sleep();
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          100 console errors /w 10 unique msg
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true });

            if (window.trackx) {
              for (let index = 0; index < 10_000; index++) {
                window.trackx?.sendEvent(
                  new CustomError('10000 custom errors'),
                );
                if (index % 100 === 0) {
                  setState({ status: index });
                }
                await sleep();
              }
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          10,000 sendEvent CustomError
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true });

            if (window.trackx) {
              for (let index = 0; index < 10_000; index++) {
                window.trackx?.sendEvent(new Error(`10k #${Date.now()}`));
                if (index % 100 === 0) {
                  setState({ status: index });
                }
                await sleep();
              }
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          10,000 sendEvent Error /w unique msg
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true });

            const min = 1;
            const max = 100;

            if (window.trackx) {
              for (let index = 0; index < 100_000; index++) {
                const number = Math.floor(Math.random() * (max - min) + min);
                window.trackx?.sendEvent(new Error(`100k #${number}`));
                if (index % 100 === 0) {
                  setState({ status: index });
                }
                await sleep(0);
              }
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          100,000 sendEvent /w 100 unique msg 💣 😱
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true });

            for (let index = 0; index < 30; index++) {
              console.error(new Error(`2s delay #${index + 1} ${Date.now()}`));
              setState({ status: index });
              await sleep(2000);
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          30 console error + Error /w unique msg + 2s delay
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={() => {
            setState({ active: true, status: 'Blasting...' });

            const ts = Date.now();

            for (let index = 0; index < 32; index++) {
              window.trackx?.sendEvent(new Error(`32 sendEvent: ${ts}`));
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          {/* XXX: Just enough events to trigger flood protection in the API gateway */}
          32 sendEvent Error
        </button>
      </div>

      <hr class="ns-w2" />

      <h3 id="backend-errors">Backend errors</h3>

      <div class="grid ns-gx2">
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=throw`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal error throw Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=reject1`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal unhandled promise reject Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=reject2`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal unhandled promise reject string
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=reject3`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal unhandled promise reject object
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=reject4`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal unhandled promise reject null
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=console1`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal console error string
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=console2`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal console error Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=console3`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal console error null
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=logger1`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal logger error string
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=logger2`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal logger error Error
        </button>
        <button
          class="button js-single"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=logger3`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal logger error null
        </button>
        <button
          // No .js-single since this test crashes the server
          class="button"
          onClick={() => {
            void fetch(`${config.DASH_API_ENDPOINT}/test?type=timeout`, {
              credentials: 'same-origin',
            });
          }}
        >
          Server internal unhandled setTimeout throw Error (will crash server!)
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true, status: 'Waiting...' });
            await fetch(`${config.DASH_API_ENDPOINT}/test?count=100`, {
              credentials: 'same-origin',
            });
            setState({ active: false, status: 'Done!' });
          }}
        >
          100 internal server errors
        </button>
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true, status: 'Waiting...' });
            await fetch(`${config.DASH_API_ENDPOINT}/test?count=10000`, {
              credentials: 'same-origin',
            });
            setState({ active: false, status: 'Done!' });
          }}
        >
          10,000 internal server errors
        </button>
      </div>

      <hr class="ns-w2" />

      <h3 id="send-ping">Send ping</h3>

      <div class="grid ns-gx2">
        <button
          class="button"
          disabled={state.active}
          onClick={() => {
            const img = document.createElement('img');
            img.crossOrigin = 'true';
            img.referrerPolicy = 'unsafe-url';
            img.src = `${config.REPORT_API_BASE_URL}/${config.REPORT_API_KEY}/ping`;
          }}
        >
          Ping (via img GET)
        </button>

        <button
          class="button"
          disabled={state.active}
          onClick={() => {
            navigator.sendBeacon(
              `${config.REPORT_API_BASE_URL}/${config.REPORT_API_KEY}/ping`,
            );
          }}
        >
          Ping (via send beacon POST)
        </button>

        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            await fetch(
              `${config.REPORT_API_BASE_URL}/${config.REPORT_API_KEY}/ping`,
              {
                method: 'POST',
                credentials: 'same-origin',
                mode: 'same-origin',
              },
            );
          }}
        >
          Ping (via fetch POST)
        </button>

        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            setState({ active: true });

            for (let index = 0; index < 100; index++) {
              await fetch(
                `${config.REPORT_API_BASE_URL}/${config.REPORT_API_KEY}/ping`,
                {
                  method: 'POST',
                  credentials: 'same-origin',
                  mode: 'same-origin',
                },
              );
              setState({ status: index });
              await sleep();
            }

            setState({ active: false, status: 'Done!' });
          }}
        >
          100 pings (via fetch POST)
        </button>
      </div>

      <hr class="ns-w2" />

      <h3 id="mock-project">Generate mock project</h3>

      <div class="grid ns-gx2">
        <button
          class="button"
          disabled={state.active}
          onClick={async () => {
            const name = `mock-${Date.now()}`;
            await fetch(`${config.DASH_API_ENDPOINT}/project`, {
              method: 'POST',
              credentials: 'same-origin',
              mode: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                origin: '*',
              }),
            });
            setState({ status: `Done! /projects/${name}` });
          }}
        >
          Create project /w random name
        </button>
      </div>

      <hr class="ns-w2" />

      <h3 id="mock-issue">Generate mock issue</h3>

      <div class="mb3">
        <label htmlFor="mock-issue-project" class="label">
          Target project
        </label>
        {!state.projects ? (
          <button
            id="mock-issue-project"
            class="button"
            onClick={async () => {
              try {
                const projects = await adHocQuery<TestPageState['projects']>(
                  'SELECT id, name FROM project',
                );
                setState({ projects });
              } catch (error: unknown) {
                console.error(error);
              }
            }}
          >
            Fetch project list
          </button>
        ) : (
          <select
            id="mock-issue-project"
            class="select"
            value={state.mockProjectId!}
            onInput={(event) => {
              setState({ mockProjectId: +event.currentTarget.value });
            }}
          >
            <For each={state.projects}>
              {(project) => <option value={project.id}>{project.name}</option>}
            </For>
          </select>
        )}
      </div>

      <div class="mb3">
        <label htmlFor="mock-issue-amount" class="label">
          Amount
        </label>
        <input
          id="mock-issue-amount"
          type="number"
          class="input"
          value={state.mockIssueAmount}
          min="1"
          onInput={(event) => {
            setState({ mockIssueAmount: +event.currentTarget.value });
          }}
        />
      </div>

      <div class="mb3">
        <button
          class="button w100"
          disabled={state.active}
          onClick={async () => {
            setState({
              active: true,
              status: `Generating ${state.mockIssueAmount} issues...`,
            });

            try {
              if (!state.mockProjectId) {
                throw new Error('Must have a project selected');
              }
              if (state.mockIssueAmount < 1) {
                throw new Error('Bad amount');
              }

              const tsMin = new Date(state.mockTimeFrom).getTime();
              const tsMax = new Date(state.mockTimeTo).getTime();

              if (!Number.isInteger(tsMin) || !Number.isInteger(tsMax)) {
                throw new TypeError('Bad time range');
              }

              const [startIssueId] = await adHocQuery(
                'SELECT MAX(id) + 1 FROM issue;',
                { pluck: true },
              );
              const tsList = [];

              for (let index = 0; index < state.mockIssueAmount; index++) {
                tsList.push(
                  Math.floor(Math.random() * (tsMax - tsMin + 1) + tsMin),
                );
              }

              tsList.sort((a, b) => a - b);

              const rows = tsList.map((ts, index) => ({
                id: (startIssueId as number) + index,
                ts,
              }));

              await adHocQuery(
                `BEGIN EXCLUSIVE TRANSACTION;${rows
                  .map(
                    (row) => `
INSERT INTO issue(id,hash,project_id,ts_last,ts_first,event_c,sess_c,name,message,uri) VALUES(${
                      row.id
                    },'mock${row.id}',${state.mockProjectId},${row.ts},${
                      row.ts
                    },1,1,'MockIssue','${row.id}','${window.location.href}');
INSERT INTO event(project_id,issue_id,ts,type,data) VALUES(${
                      state.mockProjectId
                    },${row.id},${row.ts},99,'${JSON.stringify({
                      name: 'MockIssue',
                      message: row.id,
                      uri: window.location.href,
                    })}')`,
                  )
                  .join(';')};
COMMIT;`,
                { exec: true },
              );

              setState({
                active: false,
                status: 'Done!',
              });
            } catch (error: unknown) {
              console.error(error);
              setState({ active: false, status: 'Error!' });

              // If the transaction failed, we need to rollback
              adHocQuery('ROLLBACK;', { exec: true }).catch(console.error);
            }
          }}
        >
          Inject issues
        </button>
      </div>

      <hr class="ns-w2" />

      <h3 id="mock-event">Generate mock event</h3>

      <div class="mb3">
        <label htmlFor="mock-event-project" class="label">
          Target project
        </label>
        {!state.projects ? (
          <button
            id="mock-event-project"
            class="button"
            onClick={async () => {
              try {
                const projects = await adHocQuery<TestPageState['projects']>(
                  'SELECT id, name FROM project',
                );
                setState({ projects });
              } catch (error: unknown) {
                console.error(error);
              }
            }}
          >
            Fetch project list
          </button>
        ) : (
          <select
            id="mock-event-project"
            class="select"
            value={state.mockProjectId!}
            onInput={(event) => {
              setState({ mockProjectId: +event.currentTarget.value });
            }}
          >
            <For each={state.projects}>
              {(project) => <option value={project.id}>{project.name}</option>}
            </For>
          </select>
        )}
      </div>

      <div class="mb3">
        <label htmlFor="mock-event-amount" class="label">
          Amount
        </label>
        <input
          id="mock-event-amount"
          type="number"
          class="input"
          value={state.mockEventAmount}
          min="1"
          onInput={(event) => {
            setState({ mockEventAmount: +event.currentTarget.value });
          }}
        />
      </div>

      <div class="mb3 df">
        <div class="mr2">
          <label htmlFor="mock-event-time-from" class="label">
            Time range from
          </label>
          <input
            id="mock-event-time-from"
            type="datetime-local"
            class="input"
            value={state.mockTimeFrom}
            onInput={(event) => {
              setState({ mockTimeFrom: event.currentTarget.value });
            }}
          />
        </div>
        <div>
          <label htmlFor="mock-event-time-to" class="label">
            Time range until
          </label>
          <input
            id="mock-event-time-to"
            type="datetime-local"
            class="input"
            value={state.mockTimeTo}
            onInput={(event) => {
              setState({ mockTimeTo: event.currentTarget.value });
            }}
          />
        </div>
      </div>

      <div class="mb3">
        <button
          class="button w100"
          disabled={state.active}
          onClick={async () => {
            setState({
              active: true,
              status: `Generating ${state.mockEventAmount} events...`,
            });

            try {
              if (!state.mockProjectId) {
                throw new Error('Must have a project selected');
              }
              if (state.mockEventAmount < 1) {
                throw new Error('Bad amount');
              }

              const tsMin = new Date(state.mockTimeFrom).getTime();
              const tsMax = new Date(state.mockTimeTo).getTime();

              if (!Number.isInteger(tsMin) || !Number.isInteger(tsMax)) {
                throw new TypeError('Bad time range');
              }

              const mockIssueId = await adHocQuery(
                'SELECT MAX(id) + 1 FROM issue;',
                { pluck: true },
              );
              const rows = [];

              for (let index = 0; index < state.mockEventAmount; index++) {
                rows.push({
                  ts: Math.floor(Math.random() * (tsMax - tsMin + 1) + tsMin),
                });
              }

              rows.sort((a, b) => a.ts - b.ts);

              await adHocQuery(
                `BEGIN EXCLUSIVE TRANSACTION;
INSERT INTO issue(id,hash,project_id,ts_last,ts_first,event_c,sess_c,name,message,uri) VALUES(${mockIssueId},'mock${mockIssueId}',${
                  state.mockProjectId
                },${tsMax},${tsMin},${
                  state.mockEventAmount
                },1,'MockEvent',${mockIssueId},'${window.location.href}');
INSERT INTO event(project_id,issue_id,ts,type,data) VALUES
${rows
                  .map(
                    (row) => `(${state.mockProjectId},${mockIssueId},${row.ts},99,'${JSON.stringify({
                      name: 'MockEvent',
                      message: mockIssueId,
                      uri: window.location.href,
                      meta: {
                        rnd: Math.random(),
                      },
                    })}')`,
                  )
                  .join(',\n')};
COMMIT;`,
                { exec: true },
              );

              setState({
                active: false,
                status: `Done! /issues/${mockIssueId}`,
              });
            } catch (error: unknown) {
              console.error(error);
              setState({ active: false, status: 'Error!' });

              // If the transaction failed, we need to rollback
              adHocQuery('ROLLBACK;', { exec: true }).catch(console.error);
            }
          }}
        >
          Inject events
        </button>
      </div>

      <hr class="ns-w2" />

      <h3 id="mock-session">Generate mock session</h3>

      <div class="mb3">
        <label htmlFor="mock-session-project" class="label">
          Target project
        </label>
        {!state.projects ? (
          <button
            id="mock-session-project"
            class="button"
            onClick={async () => {
              try {
                const projects = await adHocQuery<TestPageState['projects']>(
                  'SELECT id, name FROM project',
                );
                setState({ projects });
              } catch (error: unknown) {
                console.error(error);
              }
            }}
          >
            Fetch project list
          </button>
        ) : (
          <select
            id="mock-event-project"
            class="select"
            value={state.mockProjectId!}
            onInput={(event) => {
              setState({ mockProjectId: +event.currentTarget.value });
            }}
          >
            <For each={state.projects}>
              {(project) => <option value={project.id}>{project.name}</option>}
            </For>
          </select>
        )}
      </div>

      <div class="mb3">
        <label htmlFor="mock-session-amount" class="label">
          Amount
        </label>
        <input
          id="mock-session-amount"
          type="number"
          class="input"
          value={state.mockSessionAmount}
          min="1"
          onInput={(event) => {
            setState({ mockSessionAmount: +event.currentTarget.value });
          }}
        />
      </div>

      <div class="mb3 df">
        <div class="mr2">
          <label htmlFor="mock-session-time-from" class="label">
            Time range from
          </label>
          <input
            id="mock-session-time-from"
            type="datetime-local"
            class="input"
            value={state.mockTimeFrom}
            onInput={(event) => {
              setState({ mockTimeFrom: event.currentTarget.value });
            }}
          />
        </div>
        <div>
          <label htmlFor="mock-session-time-to" class="label">
            Time range until
          </label>
          <input
            id="mock-session-time-to"
            type="datetime-local"
            class="input"
            value={state.mockTimeTo}
            onInput={(event) => {
              setState({ mockTimeTo: event.currentTarget.value });
            }}
          />
        </div>
      </div>

      <div class="mb3">
        <button
          class="button w100"
          disabled={state.active}
          onClick={async () => {
            setState({
              active: true,
              status: `Generating ${state.mockSessionAmount} sessions...`,
            });

            try {
              if (!state.mockProjectId) {
                throw new Error('Must have a project selected');
              }
              if (state.mockSessionAmount < 1) {
                throw new Error('Bad amount');
              }

              const tsMin = Math.trunc(+new Date(state.mockTimeFrom) / 1000);
              const tsMax = Math.trunc(+new Date(state.mockTimeTo) / 1000);
              const rows = [];

              if (!Number.isInteger(tsMin) || !Number.isInteger(tsMax)) {
                throw new TypeError('Bad time range');
              }

              const xxhash = await import(
                // @ts-expect-error - types not important here
                // eslint-disable-next-line import/extensions
                'https://cdn.jsdelivr.net/npm/xxhash-wasm/esm/xxhash-wasm.js'
              );
              const { h64 } = await xxhash.default();

              for (let index = 0; index < state.mockSessionAmount; index++) {
                rows.push({
                  // @ts-expect-error - randomUUID is still very new
                  id: h64(crypto.randomUUID()).padStart(16, '0'),
                  // Random date, slightly skewed to the right
                  ts: Math.trunc(
                    (1 - Math.random() ** 1.25) * (tsMax - tsMin + 1) + tsMin,
                  ),
                });
              }

              rows.sort((a, b) => a.ts - b.ts);

              await adHocQuery(
                `CREATE TEMP TRIGGER IF NOT EXISTS tmp_session_ai AFTER INSERT ON session BEGIN
INSERT INTO session_graph (project_id, ts, c, e)
VALUES (new.project_id,strftime('%s', strftime('%Y-%m-%d %H:00', new.ts, 'unixepoch')), 1, new.e)
ON CONFLICT(project_id, ts) DO UPDATE SET c = c + 1, e = e + new.e;
INSERT INTO daily_pings (ts, c)
VALUES (strftime('%s', date(new.ts, 'unixepoch')), 1)
ON CONFLICT(ts) DO UPDATE SET c = c + 1;
END;
BEGIN EXCLUSIVE TRANSACTION;
INSERT INTO session(id,project_id,ts,e) VALUES
${rows
                  .map(
                    (row) => `(x'${row.id}',${state.mockProjectId},${row.ts},${Math.random() < 0.33})`,
                  )
                  .join(',\n')};
COMMIT;
DROP TRIGGER tmp_session_ai;`,
                { exec: true },
              );

              setState({
                active: false,
                status: 'Done!',
              });
            } catch (error: unknown) {
              console.error(error);
              setState({ active: false, status: 'Error!' });

              // If the transaction failed, we need to rollback
              adHocQuery('ROLLBACK;', { exec: true }).catch(console.error);
            }
          }}
        >
          Inject sessions
        </button>
      </div>

      <hr class="ns-w2" />

      <h3 id="loading-spinner">Loading spinner</h3>

      <button
        class="button"
        onClick={() => setState({ showLoading: !state.showLoading })}
      >
        Toggle
      </button>

      {state.showLoading && <Loading />}

      <hr class="ns-w2" />

      <h3 id="colour-samples">Colour samples</h3>

      <div class="clear">
        <div class="grid left mr4">
          <div class="test-color bg-black" title="black"></div>
          <div class="test-color bg-dark1" title="dark1"></div>
          <div class="test-color bg-dark2" title="dark2"></div>
          <div class="test-color bg-dark3" title="dark3"></div>
          <div class="test-color bg-dark4" title="dark4"></div>
          <div class="test-color bg-dark5" title="dark5"></div>
          <div class="test-color bg-gray1" title="gray1"></div>
          <div class="test-color bg-gray2" title="gray2"></div>
          <div class="test-color bg-gray3" title="gray3"></div>
          <div class="test-color bg-gray4" title="gray4"></div>
          <div class="test-color bg-gray5" title="gray5"></div>
          <div class="test-color bg-light1" title="light1"></div>
          <div class="test-color bg-light2" title="light2"></div>
          <div class="test-color bg-light3" title="light3"></div>
          <div class="test-color bg-light4" title="light4"></div>
          <div class="test-color bg-light5" title="light5"></div>
          <div class="test-color bg-white" title="white"></div>
        </div>

        <div class="test-color-grid grid">
          <div class="test-color bg-blue1" title="blue1"></div>
          <div class="test-color bg-blue2" title="blue2"></div>
          <div class="test-color bg-blue3" title="blue3"></div>
          <div class="test-color bg-blue4" title="blue4"></div>
          <div class="test-color bg-blue5" title="blue5"></div>
          <div class="test-color bg-green1" title="green1"></div>
          <div class="test-color bg-green2" title="green2"></div>
          <div class="test-color bg-green3" title="green3"></div>
          <div class="test-color bg-green4" title="green4"></div>
          <div class="test-color bg-green5" title="green5"></div>
          <div class="test-color bg-orange1" title="orange1"></div>
          <div class="test-color bg-orange2" title="orange2"></div>
          <div class="test-color bg-orange3" title="orange3"></div>
          <div class="test-color bg-orange4" title="orange4"></div>
          <div class="test-color bg-orange5" title="orange5"></div>
          <div class="test-color bg-red1" title="red1"></div>
          <div class="test-color bg-red2" title="red2"></div>
          <div class="test-color bg-red3" title="red3"></div>
          <div class="test-color bg-red4" title="red4"></div>
          <div class="test-color bg-red5" title="red5"></div>
          <div class="test-color bg-vermilion1" title="vermilion1"></div>
          <div class="test-color bg-vermilion2" title="vermilion2"></div>
          <div class="test-color bg-vermilion3" title="vermilion3"></div>
          <div class="test-color bg-vermilion4" title="vermilion4"></div>
          <div class="test-color bg-vermilion5" title="vermilion5"></div>
          <div class="test-color bg-rose1" title="rose1"></div>
          <div class="test-color bg-rose2" title="rose2"></div>
          <div class="test-color bg-rose3" title="rose3"></div>
          <div class="test-color bg-rose4" title="rose4"></div>
          <div class="test-color bg-rose5" title="rose5"></div>
          <div class="test-color bg-violet1" title="violet1"></div>
          <div class="test-color bg-violet2" title="violet2"></div>
          <div class="test-color bg-violet3" title="violet3"></div>
          <div class="test-color bg-violet4" title="violet4"></div>
          <div class="test-color bg-violet5" title="violet5"></div>
          <div class="test-color bg-indigo1" title="indigo1"></div>
          <div class="test-color bg-indigo2" title="indigo2"></div>
          <div class="test-color bg-indigo3" title="indigo3"></div>
          <div class="test-color bg-indigo4" title="indigo4"></div>
          <div class="test-color bg-indigo5" title="indigo5"></div>
          <div class="test-color bg-cobalt1" title="cobalt1"></div>
          <div class="test-color bg-cobalt2" title="cobalt2"></div>
          <div class="test-color bg-cobalt3" title="cobalt3"></div>
          <div class="test-color bg-cobalt4" title="cobalt4"></div>
          <div class="test-color bg-cobalt5" title="cobalt5"></div>
          <div class="test-color bg-turquoise1" title="turquoise1"></div>
          <div class="test-color bg-turquoise2" title="turquoise2"></div>
          <div class="test-color bg-turquoise3" title="turquoise3"></div>
          <div class="test-color bg-turquoise4" title="turquoise4"></div>
          <div class="test-color bg-turquoise5" title="turquoise5"></div>
          <div class="test-color bg-forest1" title="forest1"></div>
          <div class="test-color bg-forest2" title="forest2"></div>
          <div class="test-color bg-forest3" title="forest3"></div>
          <div class="test-color bg-forest4" title="forest4"></div>
          <div class="test-color bg-forest5" title="forest5"></div>
          <div class="test-color bg-lime1" title="lime1"></div>
          <div class="test-color bg-lime2" title="lime2"></div>
          <div class="test-color bg-lime3" title="lime3"></div>
          <div class="test-color bg-lime4" title="lime4"></div>
          <div class="test-color bg-lime5" title="lime5"></div>
          <div class="test-color bg-gold1" title="gold1"></div>
          <div class="test-color bg-gold2" title="gold2"></div>
          <div class="test-color bg-gold3" title="gold3"></div>
          <div class="test-color bg-gold4" title="gold4"></div>
          <div class="test-color bg-gold5" title="gold5"></div>
          <div class="test-color bg-sepia1" title="sepia1"></div>
          <div class="test-color bg-sepia2" title="sepia2"></div>
          <div class="test-color bg-sepia3" title="sepia3"></div>
          <div class="test-color bg-sepia4" title="sepia4"></div>
          <div class="test-color bg-sepia5" title="sepia5"></div>
        </div>
      </div>

      <hr class="ns-w2" />

      <h3 id="ui-components">UI components</h3>

      <div class="alert alert-info">
        <strong>TIP:</strong> Example info alert.
      </div>
      <div class="alert alert-success">
        <strong>TIP:</strong> Example success alert.
      </div>
      <div class="alert alert-warning">
        <strong>TIP:</strong> Example warning alert.
      </div>
      <div class="alert alert-danger">
        <strong>TIP:</strong> Example danger alert.
      </div>

      <div class="mb3">
        <button class="button button-clear">button-clear</button>
        <button class="button button-clear ml2" disabled>
          button-clear
        </button>
      </div>
      <div class="mb3">
        <button class="button">button</button>
        <button class="button ml2" disabled>
          button
        </button>
      </div>
      <div class="mb3">
        <button class="button button-primary">button-primary</button>
        <button class="button button-primary ml2" disabled>
          button-primary
        </button>
      </div>
      <div class="mb3">
        <button class="button button-success">button-success</button>
        <button class="button button-success ml2" disabled>
          button-success
        </button>
      </div>
      <div class="mb3">
        <button class="button button-warning">button-warning</button>
        <button class="button button-warning ml2" disabled>
          button-warning
        </button>
      </div>
      <div class="mb3">
        <button class="button button-danger">button-danger</button>
        <button class="button button-danger ml2" disabled>
          button-danger
        </button>
      </div>
      <div class="mb3">
        <button class="button button-danger-pre">button-danger-pre</button>
        <button class="button button-danger-pre ml2" disabled>
          button-danger-pre
        </button>
      </div>
      <div class="mb3">
        <a href="#" class="button-link">
          button-link
        </a>
      </div>
      <div class="mb3">
        <a href="#" class="button">
          a.button
        </a>
        {/*
        // @ts-expect-error - mock button, disabled attr ok */}
        <a href="#" class="button ml2" disabled>
          a.button
        </a>
        <a href="#" class="button button-primary">
          a.button-primary
        </a>
        {/*
        // @ts-expect-error - mock button, disabled attr ok */}
        <a href="#" class="button button-primary ml2" disabled>
          a.button-primary
        </a>
      </div>
      <div class="mb3 button-group">
        <button class="button">button 1</button>
        <button class="button">button 2</button>
        <button class="button">button 3</button>
        <button class="button">button 4</button>
      </div>
      <div class="mb3 button-group">
        <button class="button">button 1</button>
        <button class="button" disabled>
          button 2
        </button>
        <button class="button">button 3</button>
        <button class="button" disabled>
          button 4
        </button>
        <button class="button" disabled>
          button 5
        </button>
      </div>

      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <h6>Heading 6</h6>
      <p class="lead">Lead paragraph.</p>
      <p>Paragraph.</p>
      <ul>
        <li>ul item 1</li>
        <li>ul item 2</li>
        <li>
          ul item 3
          <ul>
            <li>sub ul item 1</li>
            <li>
              sub ul item 2
              <ul>
                <li>sub sub ul item 1</li>
                <li>sub sub ul item 2</li>
                <li>sub sub ul item 3</li>
              </ul>
            </li>
            <li>sub ul item 3</li>
          </ul>
        </li>
        <li>ul item 4</li>
      </ul>
      <ol>
        <li>ol item 1</li>
        <li>ol item 2</li>
        <li>
          ol item 3
          <ol>
            <li>sub ol item 1</li>
            <li>
              sub ol item 2
              <ol>
                <li>sub sub ol item 1</li>
                <li>sub sub ol item 2</li>
                <li>sub sub ol item 3</li>
              </ol>
            </li>
            <li>sub ol item 3</li>
          </ol>
        </li>
        <li>ol item 4</li>
      </ol>
      <blockquote>blockquote</blockquote>

      <hr class="ns-w2" />

      <div class="alert alert-warning z1 b0 pos-s">
        Status: <b>{state.status}</b>
      </div>
    </div>
  );
};

export default TestPage;
