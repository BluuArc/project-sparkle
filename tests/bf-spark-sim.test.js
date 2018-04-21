const fs = require('fs');
const SparkSim = require('../src/bf-spark-sim');

const unitData = JSON.parse(fs.readFileSync('./tests/info-gl.json', 'utf8'));

const sparkSim = new SparkSim({
  getUnit: id => unitData[id],
});

test('fully specified input - fire squad', async () => {
  const expectedSquadResult = [
    {
      'id': '11047',
      'alias': 'Infernal Pyre Rugahr',
      'position': 'top-left',
      'bbOrder': 6,
      'type': 'sbb',
      'actualSparks': 114,
      'possibleSparks': 114,
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
      'actualSparks': 114,
      'possibleSparks': 114,
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

  const results = await sparkSim.run(input, { sortResults: true, });

  expect(results.length).toBe(1);

  const actualResult = results[0];

  expect(actualResult.weightedPercentage).toBeCloseTo(0.9184);

  actualResult.squad.forEach((unit, index) => {
    const expectedUnit = expectedSquadResult[index];
    expect(unit).toEqual(expectedUnit);
  });
});

test('only units specified, with progress event handler - 100% spark squad', async () => {
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

  const results = await sparkSim.run(input, { sortResults: true, });
  const actualResult = results[0];
  console.log(actualResult);
  expect(actualResult.weightedPercentage).toBeCloseTo(1.0);
});

test('squad with 2 specified, 4 "(any)" units', async () => {
  const input = [
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
    {
      'id': 'X',
    },
    {
      'id': 'X',
    },
    {
      'id': 'X',
    },
    {
      'id': 'X',
    },
  ];

  const results = await sparkSim.run(input, { sortResults: true, });
  const actualResult = results[0];
  console.log(actualResult);
  // should result in perfectly sparking both units
  expect(actualResult.weightedPercentage).toBeCloseTo(1.0);
});

test('Error: < 6 unit input', async () => {
  try {
    await sparkSim.run([]);
  } catch (err) {
    expect(err.message).toMatch('Squad length must be 6');
  }
});

test('Error: < 2 actual units - 5 any', async () => {
  const input = [
    {
      id: 10011,
    },
    {
      id: 'X',
    },
    {
      id: 'X',
    },
    {
      id: 'X',
    },
    {
      id: 'X',
    },
    {
      id: 'X',
    },
  ];
  try {
    await sparkSim.run(input);
  } catch (err) {
    expect(err.message).toMatch('Must have at least 2 actual units in squad');
  }
});

test('Empty units, 2 specfied units', async () => {
  const input = [
    {
      'id': '860328',
      'type': 'sbb',
    },
    {
      'id': '860328',
      'type': 'sbb',
    },
    {
      'id': 'E',
      'position': 'top-left',
    },
    {
      'id': 'E',
      'position': 'middle-left',
    },
    {
      'id': 'E',
      'position': 'bottom-left',
    },
    {
      'id': 'E',
      'position': 'middle-right',
    },
  ];

  const results = await sparkSim.run(input, { sortResults: true, });
  const actualResult = results[0];
  console.log(actualResult);
  // should result in perfectly sparking both units
  expect(actualResult.weightedPercentage).toBeCloseTo(1.0);
});

test('Empty and Any units, 2 specified', async () => {
  const input = [
    {
      'id': '860328',
      'type': 'sbb',
    },
    {
      'id': '860328',
      'type': 'sbb',
    },
    {
      'id': 'X',
    },
    {
      'id': 'X',
    },
    {
      'id': 'X',
    },
    {
      'id': 'E',
      'position': 'middle-right',
    },
  ];

  const results = await sparkSim.run(input, { sortResults: true, });
  // should result in perfectly sparking both units
  results.forEach(result => {
    expect(result.weightedPercentage).toBeCloseTo(1.0);
  });
});

test('Empty and Any units, 2 specified, limit results to 5', async () => {
  const input = [
    {
      'id': '860328',
      'type': 'sbb',
    },
    {
      'id': '860328',
      'type': 'sbb',
    },
    {
      'id': 'X',
    },
    {
      'id': 'X',
    },
    {
      'id': 'X',
    },
    {
      'id': 'E',
      'position': 'middle-right',
    },
  ];

  const results = await sparkSim.run(
    input,
    {
      sortResults: true,
      maxResults: 5,
    });
  expect(results.length).toBeLessThanOrEqual(5);
  // should result in perfectly sparking both units
  results.forEach(result => {
    expect(result.weightedPercentage).toBeCloseTo(1.0);
  });
});

test('Error: Empty unit has BB Order', async () => {
  const input = [
    {
      id: '10011',
    },
    {
      id: 'E',
      position: 'top-left',
      bbOrder: 1,
    },
    {
      id: '10011',
    },
    {
      id: 'X',
    },
    {
      id: 'X',
    },
    {
      id: 'X',
    },
  ];
  try {
    await sparkSim.run(input);
  } catch (err) {
    expect(err.message).toMatch('Empty units must not have any BB Order');
  }
});

test('Error: highest BB order doesn\'t match max', async () => {
  const input = [
    {
      id: '10011',
    },
    {
      id: 'E',
      position: 'top-right',
    },
    {
      id: 'X',
      bbOrder: 6,
    },
    {
      id: '10011',
    },
    {
      id: 'X',
    },
    {
      id: 'X',
    },
  ];
  try {
    await sparkSim.run(input);
  } catch (err) {
    expect(err.message).toMatch('BB Order cannot exceed number of non-empty units (5)');
  }
});

test('Teleporter: Karna Masta sparks with Tilith UBB 72 times', async () => {
  const input = [{
    'id': 'X',
    'position': 'top-left',
    'bbOrder': 2,
  }, {
    'id': 'X',
    'position': 'top-right',
    'bbOrder': 3,
  }, {
    'id': '51317',
    'position': 'middle-left',
    'bbOrder': 1,
    'type': 'sbb',
  }, {
    'id': 'E',
    'position': 'middle-right',
    'type': '',
  }, {
    'id': '50256',
    'position': 'bottom-left',
    'bbOrder': 4,
    'type': 'ubb',
  }, {
    'id': 'E',
    'position': 'bottom-right',
    'type': '',
  },];

  const result = await sparkSim.run(input, { sortResults: true, threshold: 0.1, });
  expect(result[0].squad.length).toBe(6);
  const actualUnits = result[0].squad.filter(u => u.id !== 'E' && u.id !== 'X');
  expect(actualUnits.length).toBe(2);
  actualUnits.forEach(unit => {
    expect(unit.actualSparks).toBe(72);
  });
});

test('unit with unknown proc id', async () => {
  const input = [
    {
      'id': '840128',
      'alias': 'Silent Sentinel Silvie',
      'position': 'top-left',
      'bbOrder': 3,
      'type': 'sbb',
      'actualSparks': 150,
      'possibleSparks': 154,
      'delay': 0,
    },
    {
      'id': '840278',
      'alias': 'Viper Blitzkrieg Durumn',
      'position': 'top-right',
      'bbOrder': 2,
      'type': 'sbb',
      'actualSparks': 158,
      'possibleSparks': 159,
      'delay': 0,
    },
    {
      'id': '840438',
      'alias': 'Demon Ulfhednar Zelion',
      'position': 'middle-left',
      'bbOrder': 5,
      'type': 'sbb',
      'actualSparks': 108,
      'possibleSparks': 143,
      'delay': 0,
    },
    {
      'id': 'E',
      'alias': '(Empty)',
      'position': 'middle-right',
      'type': '',
      'actualSparks': 0,
      'possibleSparks': 0,
      'delay': 0,
    },
    {
      'id': '840288',
      'alias': 'Sonic Blaster Vashi',
      'position': 'bottom-left',
      'bbOrder': 1,
      'type': 'sbb',
      'actualSparks': 138,
      'possibleSparks': 138,
      'delay': 0,
    },
    {
      'id': '40507',
      'alias': 'Radiant Guardian Shera',
      'position': 'bottom-right',
      'bbOrder': 4,
      'type': 'sbb',
      'actualSparks': 234,
      'possibleSparks': 240,
      'delay': 0,
    },
  ];

  const result = await sparkSim.run(input, { sortResults: true, threshold: 0.1, });
  expect(result[0].squad.length).toBe(6);
});

test('Teleporter: Feeva sparks 102 hits, Dranoel sparks 105 hits', async () => {
  const input = [{
    'id': 'X',
    'alias': '(Any)',
    'position': 'top-left',
    'bbOrder': 4,
    'type': '',
  },
  {
    'id': 'X',
    'alias': '(Any)',
    'position': 'top-right',
    'bbOrder': 3,
    'type': '',
  },
  {
    'id': 'X',
    'alias': '(Any)',
    'position': 'middle-left',
    'bbOrder': 5,
    'type': '',
  },
  {
    'id': '830048',
    'alias': 'Dark Soul Dranoel',
    'position': 'middle-right',
    'bbOrder': 1,
    'type': 'sbb',
  },
  {
    'id': '60667',
    'alias': 'Sublime Darkness Feeva',
    'position': 'bottom-left',
    'bbOrder': 6,
    'type': 'sbb',
  },
  {
    'id': 'X',
    'alias': '(Any)',
    'position': 'bottom-right',
    'bbOrder': 2,
    'type': '',
  },];

  const result = await sparkSim.run(input, { sortResults: true, threshold: 0.1, });
  expect(result[0].squad.length).toBe(6);
  const actualUnits = result[0].squad.filter(u => u.id !== 'E' && u.id !== 'X');
  expect(actualUnits.length).toBe(2);
  actualUnits.forEach(unit => {
    if (+unit.id === 60667) {
      expect(unit.actualSparks).toBe(102);
    } else if (+unit.id === 830048) {
      expect(unit.actualSparks).toBe(105);
    } else {
      throw Error(`Unknown unit ${unit.id} - ${unit.alias}`);
    }
  });
});
