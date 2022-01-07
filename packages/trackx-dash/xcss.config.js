// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck 😢
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-var-requires, import/no-extraneous-dependencies, strict */

// FIXME: Fix ekscss compiler types then remove ts-nocheck

'use strict';

const framework = require('@ekscss/framework/config');
const { extend, preloadApply } = require('@ekscss/framework/utils');
const { onBeforeBuild, xcss } = require('ekscss');

// Generate references so #apply can be used in any file
onBeforeBuild(preloadApply);

module.exports = extend(framework, {
  globals: {
    fontStack: 'Inter, sans-serif',

    // App is textual data heavy and therefore needs a small font-size
    textSize: '17px',

    media: {
      ns: '(min-width: 40.01rem)',
      m: '(min-width: 40.01rem) and (max-width: 60rem)',
      l: '(min-width: 60.01rem)',
    },

    containerWidthMax: '75rem', // 1275px @ 17px textSize
    containerNarrowWidthMax: '37.5rem', // 637.5px @ 17px textSize
    gutterCol: '1rem',

    color: {
      primary: (x) => x.color.rose4,
      success: (x) => x.color.green5,
      warning: (x) => x.color.orange5,
      danger: (x) => x.color.red5,
      background: (x) => x.fn.color(x.color.black).mix(x.fn.color(x.color.dark1), 0.18),
      shadow: (x) => x.fn.color('#000').alpha(0.35),
      text: (x) => x.color.light1,
      muted: (x) => x.color.gray2,
      linkHover: (x) => x.color.rose5,
      zebraBackground: (x) => x.color.dark1,
    },

    hrColor: (x) => x.fn.color(x.color.light3).alpha(0.15),

    form: {
      helpTextColor: (x) => x.color.gray3,
      checkboxCheckedBackgroundColor: (x) => x.color.rose3,
      checkboxCheckedBorderColor: (x) => x.color.rose4,
    },

    input: {
      textColor: (x) => x.color.light2,
      backgroundColor: (x) => x.color.dark3,
      placeholderTextColor: (x) => x.color.gray4,
      outlineSize: '2px',
      border: (x) => xcss`1px solid ${x.color.gray1}`,
      hoverBorderColor: (x) => x.color.gray4,
      disabledBackgroundColor: (x) => x.color.dark1,
      disabledBorder: (x) => x.color.dark5,
    },

    alert: {
      backgroundColor: (x) => x.color.dark2,
      infoTextColor: (x) => x.color.blue5,
      successTextColor: (x) => x.color.success,
      warningTextColor: (x) => x.color.warning,
      dangerTextColor: (x) => x.color.danger,
    },

    card: {
      backgroundColor: (x) => x.color.dark1,
      shadow: (x) => xcss`0 2px 8px ${x.color.shadow}`,
      bodyMargin: '1rem 1.4rem',
    },

    codeInline: {
      textColor: (x) => x.fn.color(x.color.lime5).lighten(0.29),
      backgroundColor: (x) => x.fn.color(x.color.lime1).alpha(0.15),
    },
    codeBlock: {
      textColor: (x) => x.color.light3,
      backgroundColor: (x) => x.color.dark1,
    },

    spinner: {
      size: '48px',
      width: '4px',
      backgroundColor: (x) => x.color.dark2,
      animateSpeed: '496ms',
      animateTiming: 'linear',
    },

    tag: {
      textColor: 'inherit',
      backgroundColor: (x) => x.color.dark3,
      marginBetween: '0.5rem',
    },

    tooltip: {
      backgroundColor: (x) => x.color.indigo1,
    },

    // App specific config properties
    app: {
      media: {
        // Special case to use compact layout on very small screens
        xs: '(max-width: 500px)',
      },
    },
  },
});
