import './Nav.xcss';

import { NavLink } from '@maxmilton/solid-router';
import { IconDotsVertical } from '@trackx/icons';
import { createSignal, type Component } from 'solid-js';
import { Show } from 'solid-js/web';
import { logout } from '../utils';

export const Nav: Component = () => {
  const [showSubnav, setShowSubnav] = createSignal(false);

  const openUserMenu = () => {
    if (!showSubnav()) {
      setShowSubnav(true);

      document.addEventListener('click', () => setShowSubnav(false), {
        once: true,
      });
    }
  };

  return (
    <nav class="con dfc mt1 mb3">
      <a id="logo" href="/" class="fsn">
        <img src="/logo.svg" class="logo-img" alt="TrackX" />
      </a>
      <NavLink href="/projects" class="nav-item" deepMatch>
        Projects
      </NavLink>
      <NavLink href="/issues" class="nav-item" deepMatch>
        Issues
      </NavLink>

      {process.env.NODE_ENV === 'development' && (
        <NavLink href="/test" class="nav-item">
          Test
        </NavLink>
      )}

      <div class="pos-r ml-auto">
        <button
          class="button-subnav button-clear nav-item"
          title="Show submenu"
          onClick={openUserMenu}
        >
          <IconDotsVertical />
        </button>
        <Show when={showSubnav()} keyed>
          <div id="subnav" class="pos-a r0">
            <NavLink href="/stats" class="nav-item">
              Stats
            </NavLink>
            <NavLink href="/logs" class="nav-item">
              Logs
            </NavLink>
            <button class="button-clear nav-item wsn" onClick={logout}>
              Sign out
            </button>
          </div>
        </Show>
      </div>
    </nav>
  );
};
