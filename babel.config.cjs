// Babel configuration for Jest

/** @type {import('@babel/core').TransformOptions} */
module.exports = {
  presets: [
    ['@babel/preset-typescript', { allowDeclareFields: true }],
    'babel-preset-solid',
  ],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
};
