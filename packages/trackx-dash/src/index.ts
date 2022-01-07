import { AppError, checkSession, logout } from './utils';

checkSession()
  .then(() => {
    // Set default path as /issues before the router is loaded
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/issues');
    }

    import('./runtime');
  })
  .catch((error: unknown) => {
    if (!(error instanceof AppError) || error.code !== 401) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    void logout();
  });
