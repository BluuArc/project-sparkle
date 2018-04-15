/* global $ EventEmitter */
(async () => {
  const self = {
    lastActiveFn: () => { },
    $output: null,
    simWorker: null,
    workerEvents: {},
    eventEmitter: null,
    areas: {},
    unitNames: {},
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

  function initializePageElements() {
    self.areas.squadSetup = $('#squad-setup-area');
    const unitSetupTemplate = self.areas.squadSetup.find('#template-element');
    const positions = {
      'top-left': 'Top Left',
      'top-right': 'Top Right',
      'middle-left': 'Middle Left',
      'middle-right': 'Middle Right',
      'bottom-left': 'Bottom Left',
      'bottom-right': 'Bottom Right',
    };
    const dropdownValues = [
      {
        name: '(Any)',
        value: 'X',
      },
      {
        name: '(Empty)',
        value: 'E',
      },
    ].concat(Object.keys(self.unitNames).map(id => ({ value: id, name: self.unitNames[id], })));
    Object.keys(positions).forEach(positionKey => {
      const elem = unitSetupTemplate.clone();
      elem.attr('id', positionKey);
      elem.find('#position-text').text(positions[positionKey]);
      self.areas.squadSetup.append(elem);
    });
    self.areas.squadSetup.find('.ui.dropdown[name="unit-select"]')
      .dropdown({
        values: dropdownValues,
        fullTextSearch: 'exact',
      });

    self.areas.squadSetup.find('.ui.dropdown[name="bb-order"]')
      .dropdown();
    self.areas.squadSetup.find('.ui.dropdown[name="type"]')
      .dropdown();

  }

  async function init() {
    console.debug('Starting main');
    self.$output = $('p#output');
    self.eventEmitter = new EventEmitter();
    initSimWorker();

    let unitData;
    self.eventEmitter.on('ready', () => {
      Object.keys(unitData)
        .sort((a, b) => +a - +b)
        .forEach(id => {
          if (id !== '1') {
            const unit = unitData[id];
            const name = unit.name;
            const rarity = (unit.rarity === 8) ? 'OE' : unit.rarity;
            self.unitNames[id.toString()] = `${name} (${rarity})`;
          }
        });
      initializePageElements();
      // console.debug('ready, sending test data');
      // const input = [
      //   {
      //     'originalFrames': null,
      //     'id': '860318',
      //     'type': 'sbb',
      //   },
      //   {
      //     'originalFrames': null,
      //     'id': '860318',
      //     'type': 'sbb',
      //   },
      //   {
      //     'originalFrames': null,
      //     'id': '60527',
      //     'type': 'sbb',
      //   },
      //   {
      //     'originalFrames': null,
      //     'id': '60527',
      //     'type': 'sbb',
      //   },
      //   {
      //     'originalFrames': null,
      //     'id': '860328',
      //     'type': 'sbb',
      //   },
      //   {
      //     'originalFrames': null,
      //     'id': '860328',
      //     'type': 'sbb',
      //   },
      // ];
      // runSim(input);
    });

    showOutput('Getting unit data');
    unitData = await getUnitData();
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
