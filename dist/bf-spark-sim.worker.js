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
  });
  sparkSimInstance.sparkSim.onProgress(progress => {
    postMessage({ progress });
  })
}

async function runSim(input, options = { sortResults: true }) {
  return await sparkSimInstance.sparkSim.run(input, options);
}

const ajaxWrapper = {
  getData(url) {
    return new Promise((fulfill, reject) => {
      workerConsole.debug(`Starting GET of ${url}`);
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.onload = function () {
        if (request.readyState === 4) {
          if (request.status === 200) {
            workerConsole.debug(`Finished GET of ${url}`);
            fulfill(request.responseText);
          } else {
            reject(request.statusText);
          }
        } else {
          workerConsole.warn("readyState:", request.readyState);
        }
      };

      request.onerror = function () {
        reject(request.statusText);
      };

      request.onabort = function () {
        reject(`Request to ${url} was canceled`);
      };

      request.onprogress = function (e) {
        if (e.lengthComputable) {
          const progress = {
            complete: e.loaded,
            total: e.total,
            percentComplete: (e.loaded / e.total) * 100,
            message: `[PROGRESS] ${url}: ${((e.loaded / e.total) * 100).toFixed(2)}%`,
          };
          postMessage({ progress });
          // workerConsole.debug(progress.message);
        }
      };

      request.send(null);
    });
  },
  getJSON(url) {
    return ajaxWrapper.getData(url)
      .then(data => {
        try {
          return JSON.parse(data);
        } catch (err) {
          workerConsole.error(err);
          throw 'Error parsing JSON data';
        }
      });
  }
}

onmessage = async function (e) {
  workerConsole.debug('Received data', e.data);
  if (e.data.command === 'init') {
    try {
      initSparkSim(e.data.unitData);
      postMessage({ init: true });
    } catch (err) {
      workerConsole.error(err);
      postMessage({ error: err.message });
    }
  } else if (e.data.command === 'runsim') {
    try {
      const results = await runSim(e.data.input, e.data.options);
      postMessage({ results });
    } catch (err) {
      workerConsole.error(err);
      postMessage({ error: err.message });
    }
  } else if (e.data.command === 'getjson') {
    try {
      const json = await ajaxWrapper.getJSON(e.data.url);
      postMessage({ json });
    } catch (err) {
      workerConsole.error(err);
      postMessage({ error: err.message });
    }
  } else {
    postMessage({ error: 'Unknown command' });
  }
  
}
