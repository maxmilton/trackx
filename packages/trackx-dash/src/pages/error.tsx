import type { Component } from 'solid-js';
import { AppError } from '../utils';

interface ErrorPageProps {
  error?: AppError;
  reset: () => void;
}

export const ErrorPage: Component<ErrorPageProps> = (props) => {
  if (!props.error) {
    // eslint-disable-next-line no-param-reassign
    props.error = new AppError('An unknown error occurred', 500);
  }

  if (window.trackx) {
    window.trackx.sendEvent(
      props.error,
      props.error instanceof AppError
        ? {
          code: props.error.code,
          details: props.error.details,
        }
        : undefined,
    );
  }

  return (
    <div class="con">
      {/* eslint-disable-next-line jsx-a11y/heading-has-content */}
      <h1 textContent={`${props.error.code} Error`} />
      <p class="lead" textContent={props.error.message} />

      {process.env.NODE_ENV === 'development' && props.error.stack && (
        <code class="code-block" textContent={props.error.stack} />
      )}

      <div class="mt4">
        <button class="button" onClick={props.reset}>
          Try again
        </button>
        <div class="muted ma4">or</div>
        <button
          class="button button-primary mr3 ph4"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          Go to home
        </button>
        <button
          class="button"
          onClick={() => {
            window.history.back();
          }}
        >
          Go back
        </button>
      </div>
    </div>
  );
};
