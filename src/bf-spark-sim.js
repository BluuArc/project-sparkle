const EventEmitter = require('./event-emitter');
const movespeedOffsets = {
  '1': {
    'top-left': 15,
    'top-right': 30,
    'middle-left': 20,
    'middle-right': 40,
    'bottom-left': 18,
    'bottom-right': 33,
  },
  '2': {
    'top-left': 13,
    'top-right': 24,
    'middle-left': 16,
    'middle-right': 33,
    'bottom-left': 15,
    'bottom-right': 27,
  },
  '3': {
    'top-left': 10,
    'top-right': 19,
    'middle-left': 13,
    'middle-right': 26,
    'bottom-left': 12,
    'bottom-right': 21,
  },
  '4': {
    'top-left': 7,
    'top-right': 14,
    'middle-left': 9,
    'middle-right': 19,
    'bottom-left': 8,
    'bottom-right': 15,
  },
  '5': {
    'top-left': 4,
    'top-right': 9,
    'middle-left': 6,
    'middle-right': 12,
    'bottom-left': 5,
    'bottom-right': 9,
  },
};

// from Hamza Khan
const teleporterData = {
  'ezra': 19,
  'arthur': 11,
  'zeis': 25,
  'ciara': 32,
  'kalon': 48,
  'neferet': 34,
  'gabriela': 30,
  'mariela': 43,
  'zenia': 21,
  'carrol': 23,
  'zalvard': 17,
  'diastima': 21,
  'licht': 15,
  'beatrix': 23,
  'mard': 20,
};

class SparkSimulator {
  constructor(options = {}) {
    this.movespeedOffsets = options.movespeedOffsets || movespeedOffsets;
    this.teleporterData = options.teleporterData || teleporterData;
    this.getUnitFn = options.getUnit;
    this.sbbFrameDelay = 2;
    this.eventEmitter = new EventEmitter();
  }

  on (event, listener) {
    this.eventEmitter.on(event, listener);
  }

  onProgress (listener) {
    this.on('progress', listener);
  }

  async getUnit (id) {
    return await Promise.resolve(this.getUnitFn(id));
  }

  static getPositionIndex(position = '') {
    const allPositions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right',];
    return allPositions.indexOf(position);
  }

  getTeleporterOffset(unitData) {
    const filteredName = Object.keys(teleporterData)
      .filter(name => unitData.name.toLowerCase().indexOf(name) > -1)[0];
    // console.log(unitData.name, filteredName, teleporterData[filteredName]);
    return teleporterData[filteredName] || 0;
  }

  // returns an array of attacks, where each attack is an object of st/aoe classification keyed by frame times
  getOriginalFramesForUnit(unit, type) {
    const attackingProcs = ['1', '13', '14', '27', '28', '29', '47', '61', '64', '75', '11000',].concat(['46', '48', '97',]);
    const allFrames = unit[type]['damage frames'];
    const moveType = +unit.movement.skill['move type'];
    const offset = (moveType === 3 ? +unit.movement.skill['move speed'] : 0) +
      (+moveType === 2 ? this.getTeleporterOffset(unit) : 0);
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

  async getUnitData(squadEntry = {}) {   
    const unit = await this.getUnit(squadEntry.id);

    return {
      name: unit.name,
      moveType: +unit.movement.skill['move type'],
      speedType: unit.movement.skill['move speed type'].toString(),
      originalFrames: this.getOriginalFramesForUnit(unit, squadEntry.type || 'sbb'),
    };
  }

  // given a squad entry, return an object keyed by frame times where each value is a count of number of units attacking at that frame time
  getBattleFrames(squadEntry = {}) {
    if (squadEntry.id === 'X' || squadEntry.id === 'E') {
      return {};
    }
    const position = squadEntry.position;
    const { name, moveType, speedType, originalFrames, } = squadEntry.unitData;
    let frameDelay = ((+squadEntry.bbOrder - 1) * this.sbbFrameDelay) +
      (moveType === 1 ? movespeedOffsets[speedType][position] : 0); // TODO: add support for SBB frame delay of 1

    if (!isNaN(squadEntry.delay)) {
      // console.log('detected frame delay', frameDelay, '+', squadEntry.delay);
      frameDelay += +squadEntry.delay;
    }

    squadEntry.alias = squadEntry.alias || name;

    const offsetFrames = {};
    originalFrames.forEach(attack => {
      Object.keys(attack).forEach(frame => {
        const actualFrame = (+frame + frameDelay);
        if (!offsetFrames[actualFrame]) {
          offsetFrames[actualFrame] = {
            aoe: 0,
            st: 0,
          };
        }
        offsetFrames[actualFrame][attack[frame]] += 1;
      });
    });
    return offsetFrames;
  }

  // should be in format specified in input-example.json
  processSquad(units = [], numEnemies = 6) {
    const battleFrames = {};

    // initialize battle frames
    units.forEach(unit => {
      const unitFrames = this.getBattleFrames(unit);
      Object.keys(unitFrames)
        .forEach(frame => {
          if (!battleFrames[+frame]) {
            battleFrames[+frame] = {
              aoe: 0,
              st: 0,
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
          const { aoe, st, } = battleFrames[+frame];
          const [remainingAoe, remainingSt,] = [aoe - unit.battleFrames[frame].aoe, st - unit.battleFrames[frame].st,];
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
      const aliasMap = {
        X: '(Any)',
        E: '(Empty)',
      };
      return {
        id: unit.id,
        alias: unit.alias || aliasMap[unit.id],
        position: unit.position,
        bbOrder: unit.bbOrder,
        type: unit.type,
        actualSparks,
        possibleSparks,
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
      squad: sparkResults,
    };
  }

  // original source: https://initjs.org/all-permutations-of-a-set-f1be174c79f8
  getAllPermutations(arr = []) {
    const results = [];

    if (arr.length === 1) {
      results.push(arr);
      return results;
    }

    arr.forEach((d, i) => {
      const remainingElements = arr.slice(0, i).concat(arr.slice(i + 1, arr.length));
      const innerPermutations = this.getAllPermutations(remainingElements);
      innerPermutations.forEach(permutation => {
        results.push([d,].concat(permutation));
      });
    });
    return results;
  }

  // threshold is minimum value of squad sparks to keep squad
  findBestOrders(squad = [], threshold = 0.5, maxResults = 10) {
    const allOrders = [1, 2, 3, 4, 5, 6,];
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
    const permutations = this.getAllPermutations(permutedOrders);
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
        }).filter(s => !!s).concat(withOrders);
        const result = this.processSquad(tempSquad);
        if (result.weightedPercentage >= threshold) {
          results.push(result);
        }
      });
    } else {
      // console.log('All orders specfied, running sim on single order.');
      const result = this.processSquad(withOrders);
      if (result.weightedPercentage >= threshold) {
        results.push(result);
      }
    }

    // return top 10 results in descending order
    return results
      .sort((a, b) => b.weightedPercentage - a.weightedPercentage)
      .slice(0, maxResults);
  }

  findBestPositions(squad = [], threshold = 0.5, maxResults = 10) {
    const allPositions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right',];

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
    // console.log({ permutedPositions, });
    const permutations = this.getAllPermutations(permutedPositions);
    let numComplete = 0;
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
        const orderResults = this.findBestOrders(tempSquad, threshold, maxResults);

        orderResults.forEach(result => {
          if (result.weightedPercentage >= threshold) {
            results.push(result);
          }
        });

        const currentPercent = ((++numComplete / permutations.length) * 100);
        const message = `Finding Positions: ${currentPercent.toFixed(2)}% complete (${permutations.length - numComplete} remaining)`;
        // console.log(message);
        this.eventEmitter.emit('progress', {
          percentComplete: currentPercent,
          complete: numComplete,
          total: permutations.length,
          message,
        });
      });
    } else {
      // case when all positions are specified
      // console.log('All positions specified, looking for best orders');
      const orderResults = this.findBestOrders(withPositions, threshold, maxResults);

      orderResults.forEach(result => {
        if (result.weightedPercentage >= threshold) {
          results.push(result);
        }
      });
    }

    // return top 10 results in descending order
    return results
      .sort((a, b) => b.weightedPercentage - a.weightedPercentage)
      .slice(0, maxResults);
  }
  
  // check validity of squad and get unit data
  async preProcessSquad(squad = []) {
    const anyUnits = squad.filter(u => u.id === 'X');
    const emptyUnits = squad.filter(u => u.id === 'E');
    if (!Array.isArray(squad)) {
      throw Error('Input must be an array');
    } else if (squad.length !== 6) {
      throw Error('Squad length must be 6');
    } else if (anyUnits.length + emptyUnits.length > 4) {
      throw Error('Must have at least 2 actual units in squad');
    } else if (emptyUnits.filter(u => !u.position).length > 1) {
      throw Error('Must have position satisfied for every empty unit');
    }

    const loadPromises = [];
    squad.forEach(entry => {
      if (!(entry.id === 'X' || entry.id === 'E')) {
        const loadPromise = this.getUnitData(entry)
          .then(data => {
            entry.unitData = data;
          });
        loadPromises.push(loadPromise);
      }
    });

    try {
      await Promise.all(loadPromises);
    } catch (err) {
      throw err;
    }
  }

  async run (squad = [], options = {}) {
    const { threshold, sortResults, maxResults, } = options;
    await this.preProcessSquad(squad);
    const results = this.findBestPositions(squad, threshold, maxResults);
    if (sortResults) {
      results.forEach(r => {
        r.squad.sort((a, b) => SparkSimulator.getPositionIndex(a.position) - SparkSimulator.getPositionIndex(b.position));
      });
    }
    return results;
  }
}

if (module && module.exports) {
  module.exports = SparkSimulator;
}

try {
  window.SparkSimulator = SparkSimulator;
// eslint-disable-next-line no-empty
} catch (err) {}

try {
  self.SparkSimulator = SparkSimulator;
// eslint-disable-next-line no-empty
} catch (err) {}

try {
  global.SparkSimulator = SparkSimulator;
  // eslint-disable-next-line no-empty
} catch (err) { }
