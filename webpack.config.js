const path = require('path')

module.exports = {
  entry: './view/entry.js',
  output: {
    path: path.join(__dirname, 'dist/'),
    publicPath: 'dist/',
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.sass$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
          },
          {
            loader: 'sass-loader'
          }
        ]
      },
      {
        test: /\.jsx$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['babel-preset-react'],
              plugins: ['transform-react-jsx']
            }
          }
        ]
      },
      { test: /\.md$/, use: ['html-loader', 'markdown-loader'] },
      { test: /\.gif$/, use: ['file-loader'] }
    ]
  }
}
