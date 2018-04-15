/* global $ EventEmitter */
var tempGlobals;
(async () => {
  const self = {
    lastActiveFn: () => { },
    $output: null,
    simWorker: null,
    workerEvents: {},
    eventEmitter: null,
    areas: {},
    unitNames: {},
    unitTypes: {},
    formData: {},
    unitData: null,
  };

  // tempGlobals = self;

  $(document).ready(() => init());

  function getUnitData() {
    self.simWorker.postMessage({
      url: `${location.href}tests/info-gl.json`,
      command: 'getjson',
    });
    // return new Promise((fulfill, reject) => {
    //   $.get('tests/info-gl.json')
    //     .done(fulfill).fail(reject);
    // });
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
      } else if (e.data.json) {
        self.unitData = e.data.json;
        self.simWorker.postMessage({
          command: 'init',
          unitData: e.data.json,
        });
      }
    };
  }

  function notify(message, percentProgress = 100, hasError = false) {
    const bars = self.areas.progress.find('.ui.progress');
    const $message = self.areas.progress.find('.ui.message');
    bars.progress({
      percent: percentProgress,
    });
    $message.html(message);
    if (percentProgress === 100 && !hasError) {
      $message.addClass('positive');
      $message.removeClass('negative');
    } else {
      $message.removeClass('positive');
      if (hasError) {
        $message.addClass('negative');
      } else{
        $message.removeClass('negative');
      }
    }
  }

  function handleSimProgress(progress) {
    let message;
    // unit data not loaded yet
    if (Object.keys(self.unitNames).length === 0) {
      message = `Loading unit data. ${progress.percentComplete.toFixed(2)}% Complete.`;
    } else {
      const numRemaining = progress.total - progress.complete;
      message = `Running spark simulator. ${progress.percentComplete.toFixed(2)}% Complete. (${numRemaining} combinations remaining).`;
    }

    notify(message, progress.percentComplete);
  }

  function handleSimError(error) {
    console.debug('error', error);
    self.areas.simSettings.find('#run-sim-btn').removeClass('disabled');
    self.areas.squadSetup.find('.ui.dimmer').removeClass('active');
    self.areas.squadSetup.find('.ui.dimmer .ui.text.loader').text('Running Spark Sim');
    notify(error, 0, true);
  }

  function handleSimResults(results) {
    console.debug('results', results);
    self.areas.simSettings.find('#run-sim-btn').removeClass('disabled');
    self.areas.squadSetup.find('.ui.dimmer').removeClass('active');
    self.areas.squadSetup.find('.ui.dimmer .ui.text.loader').text('Running Spark Sim');
  }

  function getSimInputFromPosition(position = '') {
    const formData = self.formData[position];
    const doLockPosition = formData.positionLock.checkbox('is checked');
    const currentBBOrder = formData.order.value;
    const currentType = formData.type.val();
    return {
      id: formData.select.value,
      position: doLockPosition ? position : null,
      bbOrder: currentBBOrder === 'any' ? undefined : +currentBBOrder,
      type: currentType,
    };
  }

  function runSim() {
    const positions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'];
    const input = positions.map(getSimInputFromPosition);
    console.debug('would run sim now', input);
    self.areas.simSettings.find('#run-sim-btn').addClass('disabled');
    self.areas.squadSetup.find('.ui.dimmer').addClass('active');
    self.areas.squadSetup.find('.ui.dimmer .ui.text.loader').text('Running Spark Sim');

    self.simWorker.postMessage({
      command: 'runsim',
      input,
    });
  }

  function initializePageElements() {
    self.areas.unitEditorArea = self.areas.squadSetup.find('#unit-editor-area');
    const unitSetupTemplate = self.areas.unitEditorArea.find('#template-element');
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
      const orderDropdown = elem.find('.ui.dropdown[name="bb-order"]');
      orderDropdown.dropdown({
        onChange(value) { orderDropdown.value = value; },
      }).dropdown('set exactly', ['any',]).dropdown('save defaults');
      const bbTypeDropdown = elem.find('.ui.dropdown[name="type"]');
      const unitSelectDropdown = elem.find('.ui.dropdown[name="unit-select"]');
      unitSelectDropdown.dropdown({
        values: dropdownValues,
        fullTextSearch: 'exact',
        onChange(value) {
          unitSelectDropdown.value = value;
          const possibleTypes = self.unitTypes[value] || [];
          if (possibleTypes.length > 0) {
            const defaultValue = (possibleTypes[1] || possibleTypes[0]).value;
            bbTypeDropdown.dropdown('change values', possibleTypes)
              .dropdown('set exactly', [defaultValue, ])
              .dropdown('save defaults').removeClass('disabled');
          } else {
            bbTypeDropdown.dropdown('change values', possibleTypes)
              .dropdown('set exactly', ['', ])
              .dropdown('set text', 'No attacks found')
              .addClass('disabled');
          }
        },
      }).dropdown('set exactly', ['X',])
        .dropdown('save defaults');
      bbTypeDropdown
        .dropdown({
          onChange (value) { bbTypeDropdown.value = value; }
        }).dropdown('change values', [])
        .dropdown('set exactly', ['',])
        .dropdown('set text', 'No attacks found')
        .addClass('disabled');

      self.formData[positionKey] = {
        select: unitSelectDropdown,
        order: orderDropdown,
        type: bbTypeDropdown,
        positionLock: elem.find('.ui.checkbox#lock-position').checkbox(),
      };

      self.areas.unitEditorArea.append(elem);
    });
    

    $('#setup-area #run-sim-btn').on('click', runSim);

    self.areas.simSettings.show();
    self.areas.squadSetup.find('.ui.dimmer').removeClass('active');
    self.areas.squadSetup.find('.ui.dimmer .ui.text.loader').text('Running Spark Sim');
    notify('Spark Sim Setup Area is ready.');
  }

  async function init() {
    console.debug('Starting main');
    self.$output = $('p#output');
    self.eventEmitter = new EventEmitter();
    self.areas.squadSetup = $('#setup-area #squad-setup-area');
    self.areas.simSettings = $('#setup-area #sim-settings-area');
    self.areas.progress = $('#progress-area');

    self.areas.simSettings.hide();
    self.areas.squadSetup.find('.ui.dimmer').addClass('active');
    self.areas.squadSetup.find('.ui.dimmer .ui.text.loader').text('Loading unit data');
    initSimWorker();

    self.eventEmitter.on('ready', () => {
      console.debug('initializing form');
      const unitData = self.unitData;
      Object.keys(unitData)
        .sort((a, b) => +a - +b)
        .forEach(id => {
          if (id !== '1') {
            const possibleTypes = ['bb', 'sbb', 'ubb'];
            const unit = unitData[id];
            const name = unit.name;
            const rarity = (unit.rarity === 8) ? 'OE' : unit.rarity;
            const unitTypes = Object.keys(unit)
              .filter(key => possibleTypes.includes(key))
              .map(type => ({ name: type.toUpperCase(), value: type, }));

            if (unitTypes.length > 0) {
              self.unitNames[id.toString()] = `${name} (${rarity})`;
              self.unitTypes[id.toString()] = unitTypes;
            }
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
    getUnitData();
    
    // self.sparkSim = new SparkSimulator({
    //   getUnit: id => unitData[id]
    // });

    // const results = await self.sparkSim.run(input, { sortResults: true, });
    // showOutput(JSON.stringify(results, null, 2));
  }
})();
