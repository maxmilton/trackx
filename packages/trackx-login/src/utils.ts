export const getElement = (id: string): HTMLElement | null => document.getElementById(id);

export const create = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
): HTMLElementTagNameMap[K] => document.createElement(tagName);

export const append = <T extends Node>(node: T, parent: Node): T => parent.appendChild(node);

export const dirty = (el: Element): void => el.classList.add('dirty');
