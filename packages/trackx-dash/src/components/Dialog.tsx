import { onCleanup, onMount, type Component } from 'solid-js';
import './Dialog.xcss';

interface DialogProps {
  onClose: () => void;
}

// TODO: Add subtle animation to transition between closed<>open

export const Dialog: Component<DialogProps> = (props) => {
  let outer: HTMLDivElement;

  function handleClick(event: MouseEvent) {
    // Only on click from outside the dialog
    if (!outer.contains(event.target as Node)) {
      props.onClose();
    }
  }

  function handleESC(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.keyCode === 13) {
      props.onClose();
    }
  }

  onMount(() => {
    document.body.classList.add('scroll-lock');

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleESC);

    // On open, move the keyboard focus into the dialog
    outer.focus();
  });

  onCleanup(() => {
    document.body.classList.remove('scroll-lock');

    document.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleESC);

    // TODO: Consider moving focus back to where it was before opening the dialog
  });

  return (
    <div class="dialog-backdrop pos-f a0 z6">
      {/*
      // @ts-expect-error - ref not actually used before define */}
      <div ref={outer} class="dialog con narrow pa4" tabindex="-1">
        {props.children}
      </div>
    </div>
  );
};
