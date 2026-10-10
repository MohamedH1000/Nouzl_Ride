/**
 * Jest only. babel-preset-expo leaves dynamic `import()` for Metro, and Jest
 * (CommonJS) can't run it. This rewrites `import(x)` to
 * `Promise.resolve().then(() => require(x))`, so jest.mock() still applies,
 * and touches nothing else. (A full modules-commonjs pass runs before
 * React Native's codegen plugin and breaks its native-component files.)
 */
module.exports = function jestDynamicImport({ types: t }) {
  return {
    name: 'jest-dynamic-import',
    visitor: {
      CallExpression(path) {
        if (!t.isImport(path.node.callee)) return;
        const requireCall = t.callExpression(t.identifier('require'), path.node.arguments);
        path.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), []),
              t.identifier('then'),
            ),
            [t.arrowFunctionExpression([], requireCall)],
          ),
        );
      },
    },
  };
};
