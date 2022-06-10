import './CodeBlock.xcss';

import { IconCopy } from '@trackx/icons/src';
import { createSignal, type FlowComponent } from 'solid-js';

export const CodeBlock: FlowComponent = (props) => {
  const [copied, setCopied] = createSignal();
  let ref: HTMLElement;

  return (
    <div class="code-block-wrapper">
      {/*
      // @ts-expect-error - ref not actually used before define */}
      <code ref={ref} class="code-block">
        {props.children}
      </code>

      <button
        class="button button-copy"
        title="Copy"
        onclick={() => {
          navigator.clipboard
            .writeText(ref.textContent || '')
            .then(() => {
              setCopied(true);
              window.setTimeout(setCopied, 2000);
            })
            .catch(console.error);
        }}
      >
        {copied() ? <span class="success">Copied!</span> : <IconCopy />}
      </button>
    </div>
  );
};
