importScripts('./bf-spark-sim.js');

const workerConsole = {
  log: (...args) => console.log('[W]', ...args),
  debug: (...args) => console.debug('[W]', ...args),
  error: (...args) => console.error('[W]', ...args),
  warn: (...args) => console.warn('[W]', ...args)
};
const sparkSimInstance = {
  sparkSim: null,
  unitData: {},
  progressHandler: null,
}

function initSparkSim(unitData) {
  sparkSimInstance.unitData = unitData;
  sparkSimInstance.sparkSim = new SparkSimulator({
    getUnit: id => sparkSimInstance.unitData[id]
  })
}

async function runSim(input, options = { sortResults: true }) {
  return await sparkSimInstance.sparkSim.run(input, options);
}

onmessage = async function (e) {
  workerConsole.debug('Received data', e.data);
  if (e.data.command === 'init') {
    try {
      initSparkSim(e.data.unitData);
      postMessage({ init: true });
    } catch (err) {
      postMessage({ error: err });
    }
  } else if (e.data.command === 'runsim') {
    try {
      const results = await runSim(e.data.input, e.data.options);
      postMessage({ results });
    } catch (err) {
      postMessage({ error: err });
    }
  } else {
    postMessage({ error: 'Unknown command' });
  }
  
}
