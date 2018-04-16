const fs = require('fs');
const JSONC = require('json-comments');
const SparkSim = require('./src/bf-spark-sim');

const unitData = JSON.parse(fs.readFileSync('./tests/info-gl.json', 'utf8'));

const sparkSim = new SparkSim({
  getUnit: id => unitData[id],
});

let lastPercent;
sparkSim.onProgress(progress => {
  const currentPercent = Math.floor(progress.percentComplete);
  if (currentPercent !== lastPercent) {
    console.log(progress.message);
    lastPercent = currentPercent;
  }
});

async function main() {
  const exampleData = JSONC.parse(fs.readFileSync('input.json', 'utf8'));
  const result = await sparkSim.run(exampleData);
  fs.writeFileSync('output.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('Done');
}

main();
