import type { RouteComponent } from '@maxmilton/solid-router';
import { IconChevronRight } from '@trackx/icons';
import { createEffect, createResource, createSignal } from 'solid-js';
import { Match, Switch } from 'solid-js/web';
import type { Project } from '../../../../../trackx-api/src/types';
import { CodeBlock } from '../../../components/CodeBlock';
import { renderErrorAlert } from '../../../components/ErrorAlert';
import { Loading } from '../../../components/Loading';
import { Tabs } from '../../../components/Tabs';
import { config, fetchJSON } from '../../../utils';

// FIXME: Rework this page.
//  ↳ A high percent of the time users want the tracking + ping snippet, so
//    that should be at the top.
//  ↳ Simplify what's shown by default. Maybe have a "expand" button that will
//    show more detailed instructions. Or maybe link to the docs which should
//    have fully detailed instructions.
//  ↳ Something like a "quick start guide" and "advanced" sections.
//  ↳ It should probably at least mention the various clients.

const ProjectInstallPage: RouteComponent = (props) => {
  const [project] = createResource<Project, string>(
    () => `${config.DASH_API_ENDPOINT}/project/${props.params.name}`,
    fetchJSON,
  );

  const sharedTabSignal = createSignal(0);
  const [currentTab] = sharedTabSignal;

  createEffect(() => {
    document.title = `${props.params.name} Install | TrackX`;
  });

  const apiOriginUri = new URL(
    process.env.NODE_ENV !== 'production'
      ? window.location.origin + config.REPORT_API_BASE_URL
      : config.REPORT_API_BASE_URL,
  ).origin;

  // TODO: Add something like "see the docs for detailed install instructions
  // or if you've done this kind of thing before ..." (like GitHub on new repos)

  return (
    <div class="con">
      <div class="dfc muted">
        <a href="/projects" class="muted">
          Projects
        </a>
        <IconChevronRight />
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
        <a
          href={`/projects/${props.params.name}`}
          class="muted"
          textContent={props.params.name!}
        />
        <IconChevronRight />
        <span class="text fwm">Install</span>
      </div>

      <h1>Install</h1>

      <Switch fallback={<p class="danger">Failed to load project</p>}>
        <Match when={project.error} children={renderErrorAlert} keyed />
        <Match when={project.loading}>
          <Loading />
        </Match>
        <Match when={project()} keyed>
          {(projectData) => (
            <>
              {/* <h2>TrackX Script Installation</h2> */}
              <h2>Error Tracking Script</h2>

              {/* FIXME: Rewrite or remove this block */}
              {/* FIXME: Update link to correct documentation location */}
              {/* <p>
                For more details, alternative installation methods (such as via
                NPM or Yarn), and usage info,{' '}
                <a
                  href="https://maxmilton.github.io/trackx/"
                  target="_blank"
                  rel="noopener"
                >
                  see the trackx documentation
                </a>
                .
              </p> */}
              <p>
                Add the <code class="code-inline">trackx</code> client package
                to your web application to track JavaScript errors.
              </p>

              {/* FIXME: Update to trackx@1 once we release v1 */}

              <Tabs
                titles={['CDN', 'JavaScript', 'Node.js']}
                signal={sharedTabSignal}
              >
                <>
                  {/* CDN tab */}

                  <p>
                    Add this snippet to your HTML document head. Place it before
                    any other <code class="code-inline">{'<script>'}</code>{' '}
                    elements to ensure you capture all errors.
                  </p>

                  <CodeBlock>
                    {`<script src="https://cdn.jsdelivr.net/npm/trackx@0/default.js" crossorigin></script>
<script>window.trackx&&trackx.setup("${config.REPORT_API_BASE_URL}/${projectData.key}");</script>`}
                  </CodeBlock>
                </>
                <>
                  {/* JavaScript tab */}

                  {/* TODO: Rewrite to explain better and/or shorten + link to
                  docs for a longer more detail explanation */}

                  <p>
                    It's recommend you create a separate bundle for error
                    tracking and load the script before any other JavaScript to
                    ensure you capture all errors.
                  </p>
                  <p>1. Install the NPM package:</p>
                  <CodeBlock>npm install trackx</CodeBlock>
                  <p>2. Create a new file containing:</p>
                  <CodeBlock>
                    {`import * as trackx from 'trackx';

trackx.setup('${config.REPORT_API_BASE_URL}/${projectData.key}');

export const { sendEvent } = trackx;`}
                  </CodeBlock>
                  <p>
                    3. Configure your build process to output a seperate bundle
                    for this new file. See the{' '}
                    {/* TODO: Update this link if required + add a direct #id-heading link */}
                    <a
                      href={`${config.DOCS_URL}/#/client/tips.md#build-process`}
                      target="_blank"
                      rel="noopener"
                    >
                      docs for build process tips
                    </a>
                    .
                  </p>
                  <p>
                    4. Load the bundled script before any other{' '}
                    <code class="code-inline">{'<script>'}</code> in your
                    document.
                  </p>
                </>
                <>
                  {/* Node.js tab */}

                  {/* TODO: Rewrite to explain better and/or shorten + link to
                  docs for a longer more detail explanation */}

                  {/* TODO: Add an example or note about the origin argument
                  and why it's only on the node client */}

                  <p>
                    This method is prefered as it guarantees error tracking is
                    set up before any of your code runs and captures all errors.
                  </p>

                  <p>1. Install the NPM package:</p>
                  <CodeBlock>npm install trackx</CodeBlock>
                  <p>
                    2. Create a <code class="code-inline">trackx.js</code> file
                    containing:
                  </p>
                  <CodeBlock>
                    {`'use strict';

const trackx = require('trackx/node');

trackx.setup('${config.REPORT_API_BASE_URL}/${projectData.key}');`}
                  </CodeBlock>
                  <p>3. Require the file when you run node:</p>
                  <CodeBlock>node -r trackx.js index.js</CodeBlock>

                  <hr />

                  <p>
                    Alternatively, if you can't require a separate file before
                    your main script, call setup within your code as early as
                    possible.
                  </p>

                  <CodeBlock>
                    {`import * as trackx from 'trackx/node';

trackx.setup('${config.REPORT_API_BASE_URL}/${projectData.key}');`}
                  </CodeBlock>
                </>
              </Tabs>

              <div class="alert alert-success">
                <strong>TIP:</strong> If you only target modern web browsers,
                use the <code class="code-inline">trackx/lite</code> client to
                save bytes. See the{' '}
                <a
                  href={`${config.DOCS_URL}/#/client/overview.md#feature-comparison`}
                  target="_blank"
                  rel="noopener"
                >
                  docs for client features comparison
                </a>{' '}
                .
              </div>

              <hr class="mv4" />

              <h2>Session Ping</h2>

              <p>
                Send ping to register a session. This is an optional feature to
                track the number error-free sessions.
              </p>

              <Tabs
                titles={['CDN', 'JavaScript', 'Node.js']}
                signal={sharedTabSignal}
              >
                <>
                  {/* CDN tab */}

                  <p>
                    Add this snippet to your HTML document directly after the
                    error tracking setup script.
                  </p>

                  <CodeBlock>
                    {'<script>window.trackx&&trackx.ping();</script>'}
                  </CodeBlock>

                  <p>
                    In rare cases you can instead use an image tag. Place it
                    just after your openning{' '}
                    <code class="code-inline">{'<body>'}</code> tag. This form
                    is not recommended as the request is synchronous (blocking).
                  </p>

                  <CodeBlock>
                    {`<img src="${config.REPORT_API_BASE_URL}/${projectData.key}/ping" alt="" width="0" height="0" border="0" crossorigin />`}
                  </CodeBlock>

                  <hr />

                  <p>
                    Alternatively, you can add both error tracking and ping
                    combined using this snippet.
                  </p>

                  <CodeBlock>
                    {`<script src="https://cdn.jsdelivr.net/npm/trackx@0/default.js" crossorigin></script>
<script>window.trackx&&(trackx.setup("${config.REPORT_API_BASE_URL}/${projectData.key}"),trackx.ping());</script>`}
                  </CodeBlock>
                </>
                <>
                  {/* JavaScript tab */}

                  {/* TODO: Add link "to set full examples" see the docs */}

                  <p>
                    Call the <code class="code-inline">trackx.ping</code> method
                    after <code class="code-inline">trackx.setup</code>.
                  </p>

                  <CodeBlock>{'trackx.ping();'}</CodeBlock>

                  <hr />

                  {/* FIXME: Should mention the modern client uses fetch */}
                  <p>
                    Internally the <code class="code-inline">trackx.ping</code>{' '}
                    method creates an <code class="code-inline">Image</code> and
                    sets its <code class="code-inline">src</code>. While it's a
                    robust and cross-browser compatible technique, if you're
                    targetting newer browsers with{' '}
                    <a
                      href="https://caniuse.com/mdn-api_request_keepalive"
                      target="_blank"
                      rel="noopener"
                    >
                      fetch + keepalive support
                    </a>{' '}
                    the recommend way to send a ping is using{' '}
                    <code class="code-inline">fetch</code>.
                  </p>

                  <CodeBlock>
                    {`fetch('${config.REPORT_API_BASE_URL}/${projectData.key}/ping', {
  method: 'POST',
  mode: 'no-cors',
  keepalive: true
});`}
                  </CodeBlock>

                  {/* TODO: Explain the downsides of using sendBeacon + maybe
                  link to docs with longer explaination */}

                  {/* TODO: Maybe better to link to docs instead of having this
                  here at all */}

                  <p>
                    Another alternative is to use{' '}
                    <code class="code-inline">Navigator.sendBeacon()</code>.
                    This is not recommended as some browsers and browser
                    extensions may block the request.
                  </p>

                  <CodeBlock>
                    {`navigator.sendBeacon('${config.REPORT_API_BASE_URL}/${projectData.key}/ping');`}
                  </CodeBlock>
                </>
                <>
                  {/* Node.js tab */}

                  <p>
                    Call the <code class="code-inline">trackx.ping</code> method
                    after <code class="code-inline">trackx.setup</code>.
                  </p>

                  <CodeBlock>{'trackx.ping();'}</CodeBlock>
                </>
              </Tabs>

              <hr class="mv4" />

              <h2>Browser Reports</h2>

              <p>
                In addition to JavaScript errors, browsers can report on a
                number of different features and problems via the{' '}
                <a
                  href="https://developer.mozilla.org/en-US/docs/Web/API/Reporting_API"
                  target="_blank"
                  rel="noopener"
                >
                  Reporting API
                </a>
                . TrackX can revive those reports and group them into issues
                just like JavaScript errors!
              </p>

              <p>
                Add browser report tracking to your application by sending extra
                HTTP headers along with your web server response.
              </p>

              {/* TODO: Maybe this should be — Nginx, Apache, Wordpress,
              Others — and IIS put in the docs */}

              <Tabs titles={['Nginx', 'Apache', 'IIS', 'Others']}>
                <>
                  {/* Nginx tab */}

                  <p>
                    Add these directives to your virtual host's{' '}
                    <code class="code-inline">{'server { ... }'}</code> block:
                  </p>

                  <CodeBlock>
                    {() => `add_header Reporting-Endpoints 'default="${
                      config.REPORT_API_BASE_URL
                    }/${projectData.key}/report"' always;
add_header Report-To '{"max_age":604800,"endpoints":[{"url":"${
                      config.REPORT_API_BASE_URL
                    }/${projectData.key}/report"}]}' always;
add_header NEL '{"max_age":604800,"report_to":"default"}' always;
add_header Content-Security-Policy "default-src 'self' ${apiOriginUri};${
                      currentTab() === 0
                        ? " script-src 'self' https://cdn.jsdelivr.net 'report-sample';"
                        : ''
                    } report-uri ${config.REPORT_API_BASE_URL}/${
                      projectData.key
                    }/report;" always;`}
                  </CodeBlock>
                </>
                <>
                  {/* Apache tab */}

                  <p>
                    Add these directives to your{' '}
                    <code class="code-inline">httpd.conf</code> in your
                    VirtualHost or in a{' '}
                    <code class="code-inline">.htaccess</code> file:
                  </p>

                  <CodeBlock>
                    {() => `Header set Reporting-Endpoints 'default="${
                      config.REPORT_API_BASE_URL
                    }/${projectData.key}/report"'
Header set Report-To '{"max_age":604800,"endpoints":[{"url":"${
                      config.REPORT_API_BASE_URL
                    }/${projectData.key}/report"}]}'
Header set NEL '{"max_age":604800,"report_to":"default"}'
Header set Content-Security-Policy "default-src 'self' ${apiOriginUri};${
                      currentTab() === 0
                        ? " script-src 'self' https://cdn.jsdelivr.net 'report-sample';"
                        : ''
                    } report-uri ${config.REPORT_API_BASE_URL}/${
                      projectData.key
                    }/report;"`}
                  </CodeBlock>
                </>
                <>
                  {/* IIS tab */}

                  <p>
                    You can use the HTTP Response Headers GUI in IIS Manager or
                    add the following to your{' '}
                    <code class="code-inline">web.config</code>:
                  </p>

                  <CodeBlock>
                    {() => `<system.webServer>
  <httpProtocol>
    <customHeaders>
      <add name="Reporting-Endpoints" value="default=\\"${
        config.REPORT_API_BASE_URL
      }/${projectData.key}/report\\"" />
      <add name="Report-To" value="{\\"max_age\\":604800\\"endpoints\\":[{\\"url\\":\\"${
        config.REPORT_API_BASE_URL
      }/${projectData.key}/report\\"}]}" />
      <add name="NEL" value="{\\"max_age\\":604800,\\"report_to\\":\\"default\\"}" />
      <add name="Content-Security-Policy" value="default-src 'self' ${apiOriginUri};${
        currentTab() === 0
          ? " script-src 'self' https://cdn.jsdelivr.net 'report-sample';"
          : ''
      } report-uri ${config.REPORT_API_BASE_URL}/${
        projectData.key
      }/report;" />
    </customHeaders>
  </httpProtocol>
</system.webServer>`}
                  </CodeBlock>
                </>
                <>
                  {/* Others tab */}

                  <p>
                    {/* FIXME: Update link once we've written the docs page! */}
                    <a
                      href={`${config.DOCS_URL}/#/client/browser-reports.md`}
                      target="_blank"
                      rel="noopener"
                    >
                      See the docs page
                    </a>{' '}
                    for details on how to set up other hosting services and
                    platforms such as:
                  </p>

                  <ul>
                    <li>WordPress</li>
                    <li>Firebase Hosting</li>
                    <li>
                      A{' '}
                      <code class="code-inline">
                        {
                          '<meta http-equiv="Content-Security-Policy" content="..." />'
                        }
                      </code>{' '}
                      tag in your HTML document
                    </li>
                    <li>and more...</li>
                  </ul>
                </>
              </Tabs>

              <div class="alert alert-success">
                <strong>TIP:</strong> If you prefer to use a more restrictive
                Content-Security-Policy header, add{' '}
                <code class="code-inline">{apiOriginUri}</code> to the{' '}
                <code class="code-inline">img-src</code> and{' '}
                <code class="code-inline">connect-src</code> directives. When
                using the CDN hosted script also add{' '}
                <code class="code-inline">https://cdn.jsdelivr.net</code> to the{' '}
                <code class="code-inline">script-src</code> directive.
              </div>
            </>
          )}
        </Match>
      </Switch>

      <hr class="mv4" />

      <p>Once you've completed the install steps:</p>

      <a
        href={`/projects/${props.params.name}`}
        class="button button-primary mt0 ml0"
      >
        Go to project overview
      </a>
    </div>
  );
};

export default ProjectInstallPage;
