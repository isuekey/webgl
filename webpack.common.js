const path = require('path');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    app:'./src/index.js'
  },
  plugins: [
    new CleanWebpackPlugin({cleanOnceBeforeBuildPatterns:['dist']}),
    new HtmlWebpackPlugin({
      title:'webgl'
    })
  ],
  output: {
    filename:'[name].bundle.js',
    path:path.resolve(__dirname, 'dist')
  },
  module: {
    rules:[{
      test:/\.css$/,
      use:[
        'style-loader',
        'css-loader'
      ]
   },{
     test:/\.(png|svg|jpg|gif|jpeg)$/,
     use:[
        {
          loader:'url-loader',
          options:{
            limit: 204800
          }
        }
      ]
  //   },{
  //     test: /\.js$/,
  //     loader: 'babel-loader'
    }]
  }
};
