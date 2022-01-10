import type { Component } from 'solid-js';
import './Footer.xcss';

export const Footer: Component = () => (
  <footer class="footer">
    ©{' '}
    <a
      href="https://maxmilton.com"
      class="normal muted"
      target="_blank"
      rel="noopener"
    >
      Max Milton
    </a>{' '}
    ・ {process.env.APP_RELEASE} ・{' '}
    <a
      href="https://github.com/maxmilton/trackx/issues"
      target="_blank"
      rel="noopener"
    >
      report bug
    </a>
  </footer>
);
