const fs = require('fs');

const movespeedOffsets = JSON.parse(fs.readFileSync('movespeedOffsets.json', 'utf8'));
const teleporterData = JSON.parse(fs.readFileSync('teleporterData.json', 'utf8'));
const unitData = JSON.parse(fs.readFileSync('info-gl.json', 'utf8'));

const sbbFrameDelay = 2; // 2 = no BB cut-in, 1 = with BB cut-in

function getUnit(id) {
  return unitData[id];
}

// returns an array of attacks, where each attack is an object of st/aoe classification keyed by frame times
function getOriginalFramesForUnit(id, type) {
  const attackingProcs = ['1', '13', '14', '27', '28', '29', '47', '61', '64', '75', '11000'].concat(['46', '48', '97']);
  const unit = getUnit(id);
  const allFrames = unit[type]['damage frames'];
  const moveType = +unit.movement.skill['move type'];
  const offset = (moveType === 3 ? +unit.movement.skill['move speed'] : 0); // TODO: add read from teleporter data here
  let isAOE = true; // TODO: add support for skills with multiple AOE attacks
  return allFrames.filter(procFrame => attackingProcs.indexOf(procFrame['proc id'].toString()) > -1)
    .map(procFrame => {
      const effectDelay = +procFrame['effect delay time(ms)/frame'].split('/')[1];
      const damageFrames = {};
      procFrame['frame times'].forEach(val => {
        const actualVal = +val + (moveType === 2 ? 0 : effectDelay) + offset;
        damageFrames[actualVal] = isAOE ? 'aoe' : 'st';
      });
      isAOE = false;
      return damageFrames;
    });
}

// given a squad entry, return an object keyed by frame times where each value is a count of number of units attacking at that frame time
function getBattleFrames(squadEntry = {}, numEnemies = 6) {
  const position = squadEntry.position;
  if (!squadEntry.originalFrames) {
    squadEntry.originalFrames = getOriginalFramesForUnit(squadEntry.id, squadEntry.type);
  }

  const unit = getUnit(squadEntry.id);
  const moveType = +unit.movement.skill['move type'];
  const speedType = unit.movement.skill['move speed type'].toString();
  const frameDelay = ((+squadEntry.bbOrder - 1) * sbbFrameDelay) + 
    (moveType === 1 ? movespeedOffsets[speedType][position] : 0); // TODO: add support for SBB frame delay of 1

  squadEntry.alias = squadEntry.alias || unit.name;

  const offsetFrames = {};
  squadEntry.originalFrames.forEach(attack => {
    Object.keys(attack).forEach(frame => {
      const actualFrame = (+frame + frameDelay);
      if (!offsetFrames[actualFrame]) {
        offsetFrames[actualFrame] = 0;
      }
      offsetFrames[actualFrame] += (attack[frame] === 'aoe') ? numEnemies : 1;
    });
  });
  return offsetFrames;
}

// should be in format specified in input-example.json
function processSquad(units = []) {
  const battleFrames = {};

  // initialize battle frames
  units.forEach(unit => {
    const unitFrames = getBattleFrames(unit);
    Object.keys(unitFrames)
      .forEach(frame => {
        if (!battleFrames[+frame]) {
          battleFrames[+frame] = 0;
        }

        battleFrames[+frame] += unitFrames[frame];
      });
    unit.battleFrames = unitFrames;
  });

  let possibleSparksSquad = 0;
  let actualSparksSquad = 0;
  const sparkResults = units.map(unit => {
    let possibleSparks = Object.keys(unit.battleFrames)
      .map(frame => unit.battleFrames[+frame])
      .reduce((acc, val) => acc + val, 0);
    let actualSparks = Object.keys(unit.battleFrames)
      .map(frame => (battleFrames[+frame] - unit.battleFrames[+frame] > 0) ? unit.battleFrames[+frame] : 0) 
      .reduce((acc, val) => acc + val, 0);

    possibleSparksSquad += possibleSparks;
    actualSparksSquad += actualSparks;
    return {
      id: unit.id,
      alias: unit.alias,
      position: unit.position,
      bbOrder: unit.bbOrder,
      type: unit.type,
      actualSparks,
      possibleSparks
    };
  });

  return {
    actualSparks: actualSparksSquad,
    possibleSparks: possibleSparksSquad,
    squad: sparkResults
  };
}

// original source: https://initjs.org/all-permutations-of-a-set-f1be174c79f8
function getAllPermutations(arr = []) {
  const results = [];

  if (arr.length === 1) {
    results.push(arr);
    return results;
  }

  arr.forEach((d, i) => {
    const remainingElements = arr.slice(0, i).concat(arr.slice(i + 1, arr.length));
    const innerPermutations = getAllPermutations(remainingElements);
    innerPermutations.forEach(permutation => {
      results.push([d].concat(permutation));
    });
  });
  return results;
}

// threshold is minimum value of squad sparks to keep squad
function findBestOrders(squad = [], threshold = 0.5) {
  const permutations = getAllPermutations(Object.keys(squad).map(index => +index + 1));
  let results = [];
  permutations.forEach(permutation => {
    const tempSquad = permutation.map((bbOrder, index) => {
      squad[index].bbOrder = bbOrder;
      return squad[index];
    });
    const result = processSquad(tempSquad);
    if (result.actualSparks / result.possibleSparks >= threshold) {
      results.push(result);
    }
  });

  // return top 10 results
  return results.sort((a, b) => {
    const resultA = a.actualSparks / a.possibleSparks;
    const resultB = b.actualSparks / b.possibleSparks;
    return resultB - resultA; // sort in descending order
  }).slice(0,10);
}

function findBestPositions(squad = [], threshold = 0.5) {
  const positions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'];
  const permutations = getAllPermutations(positions);
  let numComplete = 0;
  let results = [];
  permutations.forEach(permutation => {
    const tempSquad = permutation.map((position, index) => {
      squad[index].position = position;
      return squad[index];
    });
    const orderResults = findBestOrders(tempSquad, threshold);
    
    orderResults.forEach(result => {
      if (result.actualSparks / result.possibleSparks >= threshold) {
        results.push(result);
      }
    })

    if (Math.floor((++numComplete / permutations.length)*100) % 5 === 0) {
      console.log(`Finding Positions: ${((numComplete / permutations.length)*100).toFixed(2)}% complete (${permutations.length - numComplete} remaining)`);
    }
  });

  // return top 10 results
  return results.sort((a, b) => {
    const resultA = a.actualSparks / a.possibleSparks;
    const resultB = b.actualSparks / b.possibleSparks;
    return resultB - resultA; // sort in descending order
  }).slice(0, 10);
}

const exampleData = JSON.parse(fs.readFileSync('input-example.json', 'utf8'));
const result = findBestPositions(exampleData);
fs.writeFileSync('output.json', JSON.stringify(result, null, 2), 'utf8');
console.log('Done');
