import type { JSX } from 'solid-js';

export const renderErrorAlert = (error: unknown): JSX.Element => (
  <div class="alert alert-danger">
    <strong>ERROR: </strong>
    <span textContent={`${error}` || 'Unknown error'} />
  </div>
);
