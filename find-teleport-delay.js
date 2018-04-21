const fs = require('fs');
const SparkSim = require('./src/bf-spark-sim');

const unitData = JSON.parse(fs.readFileSync('./tests/info-gl.json', 'utf8'));

const sparkSim = new SparkSim({
  getUnit: id => unitData[id],
  teleporterData: {},
});

let lastPercent;
sparkSim.onProgress(progress => {
  const currentPercent = Math.floor(progress.percentComplete);
  if (currentPercent !== lastPercent) {
    console.log(progress.message);
    lastPercent = currentPercent;
  }
});

// eslint-disable-next-line no-unused-vars
async function main() {
  // otherUnits and teleportingUnit should be as specific as possible
  // in order to speed up the calculation time for one delay
  const otherUnits = [{
    'id': 'X',
    'alias': '(Any)',
    'position': 'top-left',
    'bbOrder': 4,
    'type': '',
    // 'delay': 0,
  }, {
    'id': 'X',
    'alias': '(Any)',
    'position': 'top-right',
    'bbOrder': 3,
    'type': '',
    // 'delay': 0,
  }, {
    'id': 'X',
    'alias': '(Any)',
    'position': 'middle-left',
    'bbOrder': 5,
    'type': '',
    // 'delay': 0,
  }, {
    'id': '60667',
    'alias': 'Sublime Darkness Feeva',
    'position': 'bottom-left',
    'bbOrder': 6,
    'type': 'sbb',
    // 'actualSparks': 102,
    // 'possibleSparks': 252,
    // 'delay': 0,
  }, {
    'id': 'X',
    'alias': '(Any)',
    'position': 'bottom-right',
    'bbOrder': 2,
    'type': '',
    // 'delay': 0,
  },];
  const teleportingUnit = {
    'id': '830048',
    'alias': 'Dark Soul Dranoel',
    'position': 'middle-right',
    'bbOrder': 1,
    'type': 'sbb',
    // 'actualSparks': 105,
    // 'possibleSparks': 105,
    // 'delay': 0,
  };
  
  let currentDelay = 0;
  const targetSparks = 105;
  const delays = [];
  while (currentDelay <= 5000) {
    console.log('testing delay', currentDelay);
    teleportingUnit.delay = currentDelay++;
    delete teleportingUnit.unitData;
    delete teleportingUnit.battleFrames;
    const result = await sparkSim.run(otherUnits.concat([teleportingUnit,]), { sortResults: true, threshold: 0.01, });
    if (result.length === 0) {
      continue;
    }
    const resultTeleporter = result[0].squad.filter(unit => unit.delay !== undefined);
    // if (resultTeleporter[0].actualSparks > 0) console.log(resultTeleporter);
    console.log(resultTeleporter);
    if (resultTeleporter[0].actualSparks === targetSparks) {
      delays.push(result[0]);
    }
  }
  fs.writeFileSync('output.json', JSON.stringify(delays, null, 2), 'utf8');
  console.log('Done');
}

// eslint-disable-next-line no-unused-vars
function getTeleporterUnits() {
  const teleportingUnits = Object.values(unitData)
    // only get OE teleporting units
    .filter(unit => +unit.movement.skill['move type'] === 2 && +unit.rarity === 8)
    .map(({id, name, }) => ({ id, name, }));
  fs.writeFileSync('teleporters.json', JSON.stringify(teleportingUnits, null, 2), 'utf8');
  console.log('Done getting teleporting units');
}

// getTeleporterUnits();
main();
