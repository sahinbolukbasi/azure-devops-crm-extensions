const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    'time-entry-tab': './src/time-entry-tab.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/time-entry-tab.html',
      filename: 'time-entry-tab.html',
      chunks: ['time-entry-tab']
    })
  ],
  externals: {
    'azure-devops-extension-sdk': 'SDK',
    'azure-devops-extension-api': 'API'
  },
  devtool: 'source-map'
};
