const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  devtool:'inline-source-map',
  devServer:{
    contentBase:'./dist'
  },
  output: {
    publicPath:'/'
  },
  module: {
    rules:[{
     test:/\.(png|svg|jpg|gif|jpeg)$/,
     use:[
        {
          loader:'file-loader',
        }
      ]
  //   },{
  //     test: /\.js$/,
  //     loader: 'babel-loader'
    }]
  }
});
