const fs = require('fs');
const SparkSim = require('../src/bf-spark-sim');

const unitData = JSON.parse(fs.readFileSync('./tests/info-gl.json', 'utf8'));

const sparkSim = new SparkSim({
  getUnit: id => unitData[id],
});

test('fully specified input - fire squad', () => {
  const expectedSquadResult = [
    {
      'id': '11047',
      'alias': 'Infernal Pyre Rugahr',
      'position': 'top-left',
      'bbOrder': 6,
      'type': 'sbb',
      'actualSparks': 89,
      'possibleSparks': 89,
    },
    {
      'id': '10257',
      'alias': 'Vesta Padma Michele',
      'position': 'top-right',
      'bbOrder': 2,
      'type': 'sbb',
      'actualSparks': 135,
      'possibleSparks': 228,
    },
    {
      'id': '60497',
      'alias': 'Necromancer Lilly Matah',
      'position': 'middle-left',
      'bbOrder': 3,
      'type': 'sbb',
      'actualSparks': 0,
      'possibleSparks': 0,
    },
    {
      'id': '810278',
      'alias': 'Starpyre Lancer Zeis',
      'position': 'middle-right',
      'bbOrder': 4,
      'type': 'sbb',
      'actualSparks': 141,
      'possibleSparks': 141,
    },
    {
      'id': '11047',
      'alias': 'Infernal Pyre Rugahr',
      'position': 'bottom-left',
      'bbOrder': 5,
      'type': 'sbb',
      'actualSparks': 89,
      'possibleSparks': 89,
    },
    {
      'id': '810278',
      'alias': 'Starpyre Lancer Zeis',
      'position': 'bottom-right',
      'bbOrder': 1,
      'type': 'sbb',
      'actualSparks': 141,
      'possibleSparks': 141,
    },
  ];

  const input = [
    {
      'originalFrames': null,
      'id': '11047',
      'type': 'sbb',
      'bbOrder': 6,
      'position': 'top-left',
    },
    {
      'originalFrames': null,
      'id': '11047',
      'type': 'sbb',
      'bbOrder': 5,
      'position': 'bottom-left',
    },
    {
      'originalFrames': null,
      'id': '810278',
      'type': 'sbb',
      'bbOrder': 4,
      'position': 'middle-right',
    },
    {
      'originalFrames': null,
      'id': '810278',
      'type': 'sbb',
      'bbOrder': 1,
      'position': 'bottom-right',
    },
    {
      'originalFrames': null,
      'id': '60497',
      'type': 'sbb',
      'bbOrder': 3,
      'position': 'middle-left',
    },
    {
      'originalFrames': null,
      'id': '10257',
      'type': 'sbb',
      'bbOrder': 2,
      'position': 'top-right',
    },
  ];

  const results = sparkSim.run(input, { sortResults: true, });

  expect(results.length).toBe(1);

  const actualResult = results[0];

  expect(actualResult.weightedPercentage).toBeCloseTo(0.9184);

  actualResult.squad.forEach((unit, index) => {
    const expectedUnit = expectedSquadResult[index];
    expect(unit).toEqual(expectedUnit);
  });
});

test('only units specified, with progress event handler - 100% spark squad', () => {
  const input = [
    {
      'originalFrames': null,
      'id': '860318',
      'type': 'sbb',
    },
    {
      'originalFrames': null,
      'id': '860318',
      'type': 'sbb',
    },
    {
      'originalFrames': null,
      'id': '60527',
      'type': 'sbb',
    },
    {
      'originalFrames': null,
      'id': '60527',
      'type': 'sbb',
    },
    {
      'originalFrames': null,
      'id': '860328',
      'type': 'sbb',
    },
    {
      'originalFrames': null,
      'id': '860328',
      'type': 'sbb',
    },
  ];

  sparkSim.onProgress(event => {
    console.log(event.message);
  });

  const results = sparkSim.run(input, { sortResults: true, });

  const actualResult = results[0];

  console.log(actualResult);

  expect(actualResult.weightedPercentage).toBeCloseTo(1.0);

});
