const fs = require('fs');
const JSONC = require('json-comments');

const movespeedOffsets = JSON.parse(fs.readFileSync('movespeedOffsets.json', 'utf8'));
const teleporterData = JSON.parse(fs.readFileSync('teleporterData.json', 'utf8'));
const unitData = JSON.parse(fs.readFileSync('info-gl.json', 'utf8'));

const sbbFrameDelay = 2; // 2 = no BB cut-in, 1 = with BB cut-in

function getUnit(id) {
  return unitData[id];
}

function getPositionIndex(position = '') {
  const allPositions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'];
  return allPositions.indexOf(position);
}

function getTeleporterOffset(unitData) {
  const filteredName = Object.keys(teleporterData)
    .filter(name => unitData.name.toLowerCase().indexOf(name) > -1)[0];
  // console.log(unitData.name, filteredName, teleporterData[filteredName]);
  return teleporterData[filteredName] || 0;
}

// returns an array of attacks, where each attack is an object of st/aoe classification keyed by frame times
function getOriginalFramesForUnit(id, type) {
  const attackingProcs = ['1', '13', '14', '27', '28', '29', '47', '61', '64', '75', '11000'].concat(['46', '48', '97']);
  const unit = getUnit(id);
  const allFrames = unit[type]['damage frames'];
  const moveType = +unit.movement.skill['move type'];
  const offset = (moveType === 3 ? +unit.movement.skill['move speed'] : 0) +
    (+moveType === 2 ? getTeleporterOffset(unit) : 0); // TODO: add read from teleporter data here
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
        offsetFrames[actualFrame] = {
          aoe: 0,
          st: 0
        };
      }
      offsetFrames[actualFrame][attack[frame]] += 1;
    });
  });
  return offsetFrames;
}

// should be in format specified in input-example.json
function processSquad(units = [], numEnemies = 6) {
  const battleFrames = {};

  // initialize battle frames
  units.forEach(unit => {
    const unitFrames = getBattleFrames(unit);
    Object.keys(unitFrames)
      .forEach(frame => {
        if (!battleFrames[+frame]) {
          battleFrames[+frame] = {
            aoe: 0,
            st: 0
          };
        }

        battleFrames[+frame].aoe += unitFrames[frame].aoe;
        battleFrames[+frame].st += unitFrames[frame].st;
      });
    unit.battleFrames = unitFrames;
  });

  let possibleSparksSquad = 0;
  let actualSparksSquad = 0;
  const sparkResults = units.map(unit => {
    let possibleSparks = Object.keys(unit.battleFrames)
      .map(frame => unit.battleFrames[+frame].aoe * numEnemies + unit.battleFrames[+frame].st)
      .reduce((acc, val) => acc + val, 0);
    let actualSparks = Object.keys(unit.battleFrames)
      .map(frame => {
        const { aoe, st } = battleFrames[+frame];
        const [ remainingAoe, remainingSt ] = [aoe - unit.battleFrames[frame].aoe, st - unit.battleFrames[frame].st];
        const hasAoe = unit.battleFrames[frame].aoe > 0 && remainingAoe > 0;
        const hasSt = (
          unit.battleFrames[frame].st > 0 && remainingSt > 0 ||
          unit.battleFrames[frame].st > 0 && remainingAoe > 0 ||
          unit.battleFrames[frame].aoe > 0 && remainingSt > 0 && !hasAoe
        );
        let count = 0;
        if (hasAoe) {
          count += unit.battleFrames[frame].aoe * numEnemies;
        }

        if (hasSt) {
          count += Math.max(unit.battleFrames[frame].st, 1);
        }
        return count;
      }).reduce((acc, val) => acc + val, 0);

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

  const perUnitPercentages = sparkResults
    .filter(u => u.possibleSparks > 0)
    .map(u => u.actualSparks / u.possibleSparks);
  
  const weightedPercentage = perUnitPercentages
    .map(val => val * (1 / perUnitPercentages.length))
    .reduce((acc, val) => acc + val, 0);

  return {
    actualSparks: actualSparksSquad,
    possibleSparks: possibleSparksSquad,
    weightedPercentage,
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
  const allOrders = [1, 2, 3, 4, 5, 6];
  const withOrders = [], noOrders = [];
  squad.forEach(unit => {
    if (!isNaN(unit.bbOrder) && allOrders.indexOf(unit.bbOrder) > -1) {
      withOrders.push(unit);
    } else {
      noOrders.push(unit);
    }
  });
  const inputOrders = withOrders.map(unit => +unit.bbOrder);
  const permutedOrders = allOrders.filter(order => inputOrders.indexOf(order) === -1);
  const permutations = getAllPermutations(permutedOrders);
  let results = [];
  if (permutations.length > 0) {
    permutations.forEach(permutation => {
      const tempSquad = permutation.map((bbOrder, index) => {
        if (!noOrders[index]) {
          return undefined;
        }

        return {
          ...(noOrders[index]),
          bbOrder,
        };
      }).filter(s => !!s).concat(withOrders)
      const result = processSquad(tempSquad);
      if (result.weightedPercentage >= threshold) {
        results.push(result);
      }
    });
  } else {
    console.log('All orders specfied, running sim on single order.');
    const result = processSquad(withOrders);
    if (result.weightedPercentage >= threshold) {
      results.push(result);
    }
  }

  // return top 10 results in descending order
  return results
    .sort((a, b) => b.weightedPercentage - a.weightedPercentage)
    .slice(0,10);
}

function findBestPositions(squad = [], threshold = 0.5, sortResults = true) {
  const allPositions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'];

  // separate squad into 2 groups, 1 for units with specified positions, 1 for units without positions
  const withPositions = [], noPositions = [];
  squad.forEach(unit => {
    if (unit.position && allPositions.indexOf(unit.position) > -1) {
      withPositions.push(unit);
    } else {
      noPositions.push(unit);
    }
  });
  const inputPositions = withPositions.map(unit => unit.position);

  // positions that aren't specified in squad
  const permutedPositions = allPositions.filter(p => inputPositions.indexOf(p) === -1);
  console.log({ permutedPositions })
  const permutations = getAllPermutations(permutedPositions);
  let numComplete = 0;
  let lastLoggedPercent = -1;
  let results = [];
  if (permutations.length > 0) {
    permutations.forEach(permutation => {
      const tempSquad = permutation.map((position, index) => {
        if (!noPositions[index]) {
          return undefined;
        }
  
        return {
          ...(noPositions[index]),
          position,
        };
      }).filter(s => !!s).concat(withPositions);
      const orderResults = findBestOrders(tempSquad, threshold);
      
      orderResults.forEach(result => {
        if (result.weightedPercentage >= threshold) {
          results.push(result);
        }
      });
  
      const currentPercent = Math.floor((++numComplete / permutations.length) * 100);
  
      if (currentPercent % 5 === 0 && currentPercent !== lastLoggedPercent) {
        lastLoggedPercent = currentPercent;
        console.log(`Finding Positions: ${currentPercent}% complete (${permutations.length - numComplete} remaining)`);
      }
    });
  } else {
    // case when all positions are specified
    console.log('All positions specified, looking for best orders');
    const orderResults = findBestOrders(withPositions, threshold);

    orderResults.forEach(result => {
      if (result.weightedPercentage >= threshold) {
        results.push(result);
      }
    });
  }

  // return top 10 results in descending order
  const finalResults = results
    .sort((a, b) => b.weightedPercentage - a.weightedPercentage)
    .slice(0, 10);
  if (sortResults) {
    finalResults.forEach(r => {
      r.squad.sort((a, b) => getPositionIndex(a.position) - getPositionIndex(b.position));
    });
  }
  return finalResults;
}

const exampleData = JSONC.parse(fs.readFileSync('input.json', 'utf8'));
const result = findBestPositions(exampleData);
fs.writeFileSync('output.json', JSON.stringify(result, null, 2), 'utf8');
console.log('Done');
