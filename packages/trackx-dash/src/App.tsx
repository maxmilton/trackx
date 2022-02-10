import { Route, Router, routeTo } from '@maxmilton/solid-router';
import { JSX, lazy } from 'solid-js';
import { ErrorBoundary, Suspense } from 'solid-js/web';
import { Debug } from './components/Debug';
import { Footer } from './components/Footer';
import { Loading } from './components/Loading';
import { Nav } from './components/Nav';
import './css/index.xcss';
import { ErrorPage } from './pages/error';
import { AppError } from './utils';

const routes: Route[] = [
  {
    path: '/projects',
    component: lazy(() => import('./pages/projects')),
  },
  {
    path: '/projects/new',
    component: lazy(() => import('./pages/projects/new')),
  },
  {
    path: '/projects/:name',
    component: lazy(() => import('./pages/projects/[name]')),
  },
  {
    path: '/projects/:name/install',
    component: lazy(() => import('./pages/projects/[name]/install')),
  },
  {
    path: '/projects/:name/settings',
    component: lazy(() => import('./pages/projects/[name]/settings')),
  },
  {
    path: '/issues',
    component: lazy(() => import('./pages/issues')),
  },
  {
    path: '/issues/:id',
    component: lazy(() => import('./pages/issues/[id]')),
  },
  {
    path: '/stats',
    component: lazy(() => import('./pages/stats')),
  },
  {
    path: '/logs',
    component: lazy(() => import('./pages/logs')),
  },
  {
    path: '/',
    component: () => routeTo('/issues', true) as unknown as JSX.Element,
  },
];

if (process.env.NODE_ENV === 'development') {
  routes.push({
    path: '/test',
    component: lazy(() => import('./pages/test')),
  });
}

// TODO: Graceful error handling when network is down and can't fetch routes or
// API + when the CDN was purged and old files are no longer available
export const App = (): JSX.Element => (
  <>
    <ErrorBoundary
      fallback={(error, reset) => <ErrorPage error={error} reset={reset} />}
    >
      <Nav />

      <Suspense
        fallback={
          <div class="df ahm">
            <Loading />
          </div>
        }
      >
        <Router
          routes={routes}
          fallback={() => {
            throw new AppError('Not found', 404);
          }}
          onRouted={() => window.scrollTo(0, 0)}
        />
      </Suspense>
    </ErrorBoundary>

    <Footer />

    {process.env.NODE_ENV === 'development' && <Debug />}
  </>
);
