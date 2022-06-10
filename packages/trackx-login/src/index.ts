/* eslint-disable prefer-template */

import './index.xcss';

import * as config from '../../trackx-dash/trackx.config.mjs';
import {
  append, create, dirty, getElement,
} from './utils';

interface ErrorWithCode extends Error {
  code: number;
}

const form = getElement('login') as HTMLFormElement;
const feedback = getElement('feedback') as HTMLDivElement;
const email = getElement('email') as HTMLInputElement;
const password = getElement('password') as HTMLInputElement;
const submit = getElement('submit') as HTMLButtonElement;

email.oninput = () => dirty(email);
password.oninput = () => dirty(password);

form.onsubmit = async (event) => {
  event.preventDefault();

  submit.disabled = true;
  feedback.textContent = '';

  dirty(email);
  dirty(password);

  try {
    const res = await fetch(config.DASH_API_ENDPOINT + '/login', {
      method: 'POST',
      credentials: 'same-origin',
      mode: 'same-origin',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      }),
    });

    if (!res.ok) {
      const err = new Error(await res.text()) as ErrorWithCode;
      err.code = res.status;
      throw err;
    }

    window.location.replace('/');
  } catch (error: unknown) {
    if (error instanceof Error && (error as ErrorWithCode).code !== 403) {
      // eslint-disable-next-line no-console
      console.error(error);
    }

    const alert = create('div');
    const title = create('b');
    title.textContent = 'Error: ';
    alert.className = 'alert alert-danger';
    append(title, alert);
    // Use simple Text node to remove potential XSS attack vector
    append(new Text(String(error)), alert);
    append(alert, feedback);

    submit.disabled = false;
  }
};
