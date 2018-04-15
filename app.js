/* global $ EventEmitter */
(async () => {
  const self = {
    lastActiveFn: () => { },
    $output: null,
    simWorker: null,
    workerEvents: {},
    eventEmitter: null,
  };

  $(document).ready(() => init());
  function getUnitData() {
    return new Promise((fulfill, reject) => {
      $.get('tests/info-gl.json')
        .done(fulfill).fail(reject);
    });
  }

  function showOutput(msg) {
    self.$output.html(msg);
  }

  function initSimWorker() {
    self.simWorker = new Worker('dist/bf-spark-sim.worker.js');
    self.simWorker.onmessage = function (e) {
      console.debug('Received worker data', e.data);
      if (typeof self.lastActiveFn === 'function') {
        self.lastActiveFn(e.data);
      }

      if (e.data.init) {
        self.eventEmitter.emit('ready');
      } else if (e.data.progress) {
        handleSimProgress(e.data.progress);
      } else if (e.data.error) {
        handleSimError(e.data.error);
      } else if (e.data.results) {
        handleSimResults(e.data.results);
      }
    };
  }

  function handleSimProgress(progress) {
    console.debug('progress', progress);
  }

  function handleSimError(error) {
    console.debug('error', error);
  }

  function handleSimResults(results) {
    console.debug('results', results);
  }

  function runSim(input) {
    self.simWorker.postMessage({
      command: 'runsim',
      input,
    });
  }

  async function init() {
    console.debug('Starting main');
    self.$output = $('p#output');
    self.eventEmitter = new EventEmitter();
    initSimWorker();

    self.eventEmitter.on('ready', () => {
      console.debug('ready, sending test data');
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
      runSim(input);
    });

    showOutput('Getting unit data');
    const unitData = await getUnitData();
    self.simWorker.postMessage({
      command: 'init',
      unitData,
    });
    // self.sparkSim = new SparkSimulator({
    //   getUnit: id => unitData[id]
    // });

    // const results = await self.sparkSim.run(input, { sortResults: true, });
    // showOutput(JSON.stringify(results, null, 2));
  }
})();
