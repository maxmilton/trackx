import { AppError } from './utils';

export const VALIDATION_ERROR = 480;

export const dirty = (el: Element): void => el.classList.add('dirty');

interface FormValidationRules {
  [elementId: string]:
  | ((value: any, data: Record<string, any>) => string | boolean | void)
  | RegExp;
}

/**
 * HTML form validation.
 *
 * @returns After validating all input rules, returns void if all valid or
 * throws error if any input is invalid.
 */
export function validate(
  form: HTMLFormElement,
  rules: FormValidationRules,
): void {
  const inputs = form.elements;
  const data: Record<string, any> = {};
  let el;
  let index = 0;
  let invalidCount = 0;

  // eslint-disable-next-line no-cond-assign, no-plusplus
  while ((el = inputs[index++] as HTMLInputElement)) {
    if (el.type !== 'button' && el.type !== 'submit' && el.id && !el.disabled) {
      // TODO: Does this result in a higher count than expected?
      if (!el.checkValidity()) {
        invalidCount += 1;
      }
      dirty(el);
      // TODO: Test this works as expect with multiple radio inputs
      //  ↳ impl ref: https://github.com/lukeed/formee/blob/master/src/index.js#L23
      data[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
    }
  }

  // eslint-disable-next-line guard-for-in, no-restricted-syntax
  for (const key in rules) {
    const rule = rules[key];
    let invalid: string | boolean | void = true;
    try {
      invalid = typeof rule === 'function'
        ? rule(data[key], data)
        : rule.test(data[key]); // eslint-disable-line @typescript-eslint/no-unsafe-argument
    } catch (error: unknown) {
      invalid = (error instanceof Error && error.message)
        || (error as string)
        || 'Validation error';
    }

    // @ts-expect-error - bracket notation with string is actually OK for HTMLFormControlsCollection
    inputs[key].classList[invalid ? 'add' : 'remove']('invalid');

    // FIXME: Don't use browser native validation notifications since they're
    // not pleasant to work with and it's better to show a permanent note until
    // the issue is fixed by the user
    // if (typeof invalid === 'string' && invalidCount === 0) {
    //   input.setCustomValidity(invalid);
    //   input.reportValidity();
    // }

    if (invalid) {
      invalidCount += 1;
    }
  }

  if (invalidCount) {
    // Scroll to the label of the invalid input -- we assume the label is
    // above the element otherwise this results in a bad UX
    const firstInvalidEl = form.querySelector('.invalid') || form.querySelector(':invalid')!;
    const matchingLabelEl = form.querySelector(`[for="${firstInvalidEl.id}"]`);
    (matchingLabelEl || firstInvalidEl)!.scrollIntoView({ behavior: 'smooth' });
    throw new AppError(
      `Form has ${invalidCount} input validation error${
        invalidCount === 1 ? '' : 's'
      }`,
      VALIDATION_ERROR,
    );
  }
}

// TODO: Reuse the same data as packages/trackx-api/src/utils.ts
export const FORBIDDEN_PROJECT_NAMES = [
  '_',
  '-',
  'create',
  'delete',
  'insert',
  'new',
  'null',
  'undefined',
  'update',
  'void',
];

// TODO: Remove if unused (prefer native input#pattern ?)
// /**
//  * Check a string is (not) comprised of only printable (not control) ASCII
//  * characters from within the "Extended ASCII" range (the first 256 characters
//  * in UTF-8).
//  */
// export function isNotASCII(str: string): boolean {
//   return !/^[\u0020-\u007E]*$/.test(str);
// }

// FIXME: Origin check is broken with chrome-extension URIs when using anything
// other than Chrome (including backend validation in node)
//  ↳ Same thing for moz-extension

/** Check a string is (not) a valid URL origin USVString. */
export function isNotOrigin(uri: string): boolean {
  return new URL(uri).origin !== uri;
}

export function isValidURL(url: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
