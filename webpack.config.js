const path = require('path');

module.exports = {
  entry: './src/bf-spark-sim.js',
  output: {
    filename: 'bf-spark-sim.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
