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

const teleporterData = {
  // from Hamza Khan
  '850328': 19, // ezra
  '750167': 11, // arthur
  '810278': 25, // zeis
  '810108': 32, // ciara
  '61007': 48, // kalon
  '860357': 34, // neferet
  '850418': 30, // gabriela
  '20887': 43, // mariela
  '860258': 21, // zenia
  '850158': 23, // carrol
  '61087': 17, // zalvard
  '51107': 21, // diastima
  '40857': 15, // licht
  '860518': 23, // beatrix
  '860548': 20, // mard
  // from BluuArc
  '51317': 105, // karna masta
  '830048': 18, // dranoel
  '61207': 29, // alza masta
  '850568': 29, // qiutong
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

  onDebug (listener) {
    this.on('debug', listener);
  }

  async getUnit (id) {
    return await Promise.resolve(this.getUnitFn(id));
  }
  
  static getSupportedTeleporters () {
    return Object.keys(teleporterData).map(id => ({ id, delay: teleporterData[id], }));
  }

  static getPositionIndex(position = '') {
    const allPositions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right',];
    return allPositions.indexOf(position);
  }

  static getValidThresholdValue (threshold) {
    return Math.max(Math.min(threshold, 100), 0);
  }

  getTeleporterOffset(unitData) {
    return this.teleporterData[unitData.id.toString()] || 0;
  }

  // returns an array of attacks, where each attack is an object of st/aoe classification keyed by frame times
  getOriginalFramesForUnit(unit, type, delay) {
    const attackingProcs = ['1', '13', '14', '27', '28', '29', '47', '61', '64', '75', '11000',].concat(['46', '48', '97',]);
    const allFrames = unit[type]['damage frames'];
    const effectFrames = unit[type].levels[0].effects;
    const moveType = +unit.movement.skill['move type'];
    let offset = (moveType === 3 ? +unit.movement.skill['move speed'] : 0) +
      (+moveType === 2 ? this.getTeleporterOffset(unit) : 0);

    if (!isNaN(delay)) {
      // console.log('detected frame delay', offset, '+', delay);
      offset += +delay;
      // console.log('new delay', offset);
    }
    let isAOE = true; // TODO: add support for skills with multiple AOE attacks
    const attackingEffectFrames = effectFrames.filter(procFrame => attackingProcs.indexOf((procFrame['proc id'] || procFrame['unknown proc id'] || '').toString()) > -1);
    return allFrames.filter(procFrame => attackingProcs.indexOf((procFrame['proc id'] || procFrame['unknown proc id'] || '').toString()) > -1)
      .map((procFrame, index) => {
        isAOE = attackingEffectFrames[index]['target area'] === 'aoe';
        const effectDelay = +procFrame['effect delay time(ms)/frame'].split('/')[1];
        const damageFrames = {};
        procFrame['frame times'].forEach(val => {
          const actualVal = +val + (moveType === 2 ? 0 : effectDelay) + offset;
          damageFrames[actualVal] = isAOE ? 'aoe' : 'st';
        });
        // console.log('WARNING: isAOE flag disabled');
        return damageFrames;
      });
  }

  async getUnitData(squadEntry = {}) {   
    const unit = await this.getUnit(squadEntry.id);

    return {
      name: unit.name,
      moveType: +unit.movement.skill['move type'],
      speedType: unit.movement.skill['move speed type'].toString(),
      originalFrames: this.getOriginalFramesForUnit(unit, squadEntry.type || 'sbb', squadEntry.delay),
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
        delay: unit.delay,
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

  // unit is an entry in squad array
  generateUnitKey(unit) {
    if (unit.id === 'X' || unit.id === 'E') {
      return '';
    }

    return `${unit.id}|${unit.type}|${unit.position}|${unit.bbOrder}`;
  }

  generateSquadKey(squad) {
    return squad
      .sort((a, b) => a.bbOrder - b.bbOrder)
      .map(this.generateUnitKey).filter(k => !!k) // remove empty/any units
      .join('-');
  }

  // threshold is minimum value of squad sparks to keep squad
  findBestOrders(squad = [], threshold = 0.5, maxResults = 10, resultCache) {
    this.eventEmitter.emit('debug', {
      text: 'entered findBestOrders',
      args: arguments,
    });
    const allOrders = [1, 2, 3, 4, 5, 6,];
    const emptyUnits = squad.filter(unit => unit.id === 'E');
    const withOrders = [], noOrders = [];
    squad.forEach(unit => {
      if (!isNaN(unit.bbOrder) && allOrders.indexOf(unit.bbOrder) > -1) {
        withOrders.push(unit);
      } else if (unit.id !== 'E') {
        noOrders.push(unit);
      }
    });
    const emptyOrders = allOrders
      .filter(order => order > (6 - emptyUnits.length))
      .map((order, index) => ({ bbOrder: order, ...(emptyUnits[index]),} ));
    const inputOrders = withOrders.map(unit => +unit.bbOrder);
    const permutedOrders = allOrders.filter(order => inputOrders.indexOf(order) === -1 && order <= (6 - emptyUnits.length));
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
        }).filter(s => !!s).concat(withOrders).concat(emptyOrders);

        const key = this.generateSquadKey(tempSquad);
        // only calculate if not calculated previously
        if (!resultCache[key]) {
          const result = this.processSquad(tempSquad);
          if (result.weightedPercentage >= threshold) {
            results.push(result);
          }
          resultCache[key] = true;
        }
      });
    } else {
      // console.log('All orders specfied, running sim on single order.');
      const result = this.processSquad(withOrders.concat(emptyOrders));
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
    const resultCache = {};

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
        this.eventEmitter.emit('debug', {
          text: 'about to enter findBestOrders',
          args: [tempSquad, threshold, maxResults, resultCache, ],
        });
        const orderResults = this.findBestOrders(tempSquad, threshold, maxResults, resultCache);

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
      const orderResults = this.findBestOrders(withPositions, threshold, maxResults, resultCache);

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
    const highestBbOrder = Math.max(0, ...(squad.filter(u => u.bbOrder !== undefined).map(u => u.bbOrder)));
    if (!Array.isArray(squad)) {
      throw Error('Input must be an array');
    } else if (squad.length !== 6) {
      throw Error('Squad length must be 6');
    } else if (anyUnits.length + emptyUnits.length > 4) {
      throw Error('Must have at least 2 actual units in squad');
    } else if (emptyUnits.filter(u => !u.position).length > 1) {
      throw Error('Must have position satisfied for every empty unit');
    } else if (emptyUnits.filter(u => u.bbOrder !== undefined).length > 0) {
      throw Error('Empty units must not have any BB Order');
    } else if (highestBbOrder > (6 - emptyUnits.length)) {
      throw Error(`BB Order cannot exceed number of non-empty units (${6 - emptyUnits.length})`);
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
    performance.mark('runSim');
    const { threshold = 0.5, sortResults, maxResults, } = options;
    await this.preProcessSquad(squad);
    const results = this.findBestPositions(squad, SparkSimulator.getValidThresholdValue(threshold), maxResults);
    if (sortResults) {
      results.forEach(r => {
        r.squad.sort((a, b) => SparkSimulator.getPositionIndex(a.position) - SparkSimulator.getPositionIndex(b.position));
      });
    }
    performance.mark('runSim');
    const marks = performance.getEntriesByName('runSim', 'mark');
    console.log(`runSim time: ${marks[1].startTime - marks[0].startTime}`);
    performance.clearMarks('runSim');
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
