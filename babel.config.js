module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        },
        modules: 'commonjs',
        // Allow modern JavaScript features for .gs files
        include: [
          '@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-proposal-nullish-coalescing-operator'
        ]
      }
    ]
  ],
  plugins: [
    // Handle .gs files as CommonJS modules
    function transformGsFiles() {
      return {
        name: 'transform-gs-files',
        visitor: {
          Program(path) {
            // Add CommonJS exports if not present
            const body = path.node.body;
            const hasExports = body.some(node => 
              (node.type === 'ExpressionStatement' && 
               node.expression.type === 'AssignmentExpression' && 
               node.expression.left.type === 'MemberExpression' &&
               node.expression.left.object.name === 'module' &&
               node.expression.left.property.name === 'exports')
            );
            
            // If no explicit exports, treat all functions as global
            if (!hasExports) {
              // No transformation needed - functions remain global
            }
          }
        }
      };
    }
  ]
};