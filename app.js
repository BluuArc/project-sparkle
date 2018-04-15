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
    positions: {
      'top-left': 'Top Left',
      'top-right': 'Top Right',
      'middle-left': 'Middle Left',
      'middle-right': 'Middle Right',
      'bottom-left': 'Bottom Left',
      'bottom-right': 'Bottom Right',
    },
  };

  function getPositionIndex(position = '') {
    const allPositions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right',];
    return allPositions.indexOf(position);
  }

  // tempGlobals = self;

  $(document).ready(() => init());

  function getUnitData() {
    self.simWorker.postMessage({
      // url: `${location.href}tests/info-gl.json`,
      url: 'https://raw.githubusercontent.com/cheahjs/bravefrontier_data/master/info.json',
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
    showSimResults(results);
  }

  // similar format to output from Python version
  function getFormattedResult(result) {
    const percent = (result.weightedPercentage * 100).toFixed(2);
    let maxNameLength = 0;
    const generateName = (unit) => `${unit.alias || unit.id}: ${unit.bbOrder}-${(unit.type || 'N/A').toUpperCase()} - (${unit.actualSparks}/${unit.possibleSparks})`;
    result.squad.forEach(unit => {
      if (unit.position.includes('left')) {
        maxNameLength = Math.max(maxNameLength, generateName(unit).length);
      }
    });
    const names = result.squad.sort((a, b) => getPositionIndex(a.position) - getPositionIndex(b.position))
      .map(unit => {
        const name = generateName(unit);
        if (unit.position.includes('left')) {
          return name.padEnd(maxNameLength, ' ') + ' | ';
        } else {
          return `${name}\n`;
        }
      });
    return [`${percent}%\n`,].concat(names).join('');
  }

  function showSimResults(results = []) {
    const simResultArea = self.areas.simResult;
    simResultArea.find('.result-segment[id!="template-element"]').remove();
    const templateElement = simResultArea.find('.result-segment#template-element');

    if (results.length === 0) {
      const elem = templateElement.clone();
      elem.attr('id', 'sim-result');
      elem.find('*').remove();
      elem.html('<div class="ui header medium">No suitable results found.</div>');
      simResultArea.append(elem);
    }

    const bbOrderMapping = {
      1: 'red',
      2: 'yellow',
      3: 'green',
      4: 'blue',
      5: 'violet',
      6: 'grey',
    };

    results.forEach((result, index) => {
      const elem = templateElement.clone();
      elem.attr('id', `sim-result-${index + 1}`);
      elem.find('#overall-sparks .value').text(`${(result.weightedPercentage * 100).toFixed(2)}%`);
      elem.find('#overall-sparks .label').text(`(Result ${index + 1})`);
      const copyButton = elem.find('#copy-squad-btn')
        .attr('data-clipboard-text', getFormattedResult(result));
      new ClipboardJS(copyButton.get(0));
      copyButton.on('click', () => {
        copyButton.text('Copied!');
      });

      const squadArea = elem.find('#squad-area');
      const templateElementUnit = squadArea.find('#template-element');
      result.squad
        .sort((a, b) => getPositionIndex(a.position) - getPositionIndex(b.position))
        .forEach(unit => {
          const unitElem = templateElementUnit.clone();
          unitElem.attr('id', unit.position);
          unitElem.find('#unit-name').text(unit.alias || unit.id);
          unitElem.find('#position-text').text(self.positions[unit.position]);
          unitElem.find('#order-type-label #bb-order').text(unit.bbOrder);
          unitElem.find('#order-type-label .detail').text((unit.type || 'N/A').toUpperCase());
          unitElem.find('#order-type-label').addClass(bbOrderMapping[+unit.bbOrder]);
          unitElem.find('#spark-statistic .value').text(`${unit.actualSparks} / ${unit.possibleSparks}`);
          squadArea.append(unitElem);
        });
      simResultArea.append(elem);
    });


    simResultArea.show();
  }

  function getSimInputFromPosition(position = '') {
    const formData = self.formData[position];
    const doLockPosition = formData.positionLock.checkbox('is checked');
    const currentBBOrder = formData.order.value;
    const currentType = formData.type.val();
    const isEmpty = formData.select.value === 'E';
    return {
      id: formData.select.value,
      position: doLockPosition || isEmpty ? position : null,
      bbOrder: currentBBOrder === 'any' ? undefined : +currentBBOrder,
      type: currentType,
    };
  }

  function runSim() {
    self.areas.simResult.hide();
    const positions = ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right',];
    const input = positions.map(getSimInputFromPosition);
    notify('Running Spark Simulator.', 0);
    console.debug('running sim now', input);
    self.areas.simSettings.find('#run-sim-btn').addClass('disabled');
    self.areas.squadSetup.find('.ui.dimmer').addClass('active');
    self.areas.squadSetup.find('.ui.dimmer .ui.text.loader').text('Running Spark Sim');

    // give time for progress bars to update
    setTimeout(() => {
      self.simWorker.postMessage({
        command: 'runsim',
        input,
      });
    }, 500);
  }

  function initializePageElements() {
    self.areas.unitEditorArea = self.areas.squadSetup.find('#unit-editor-area');
    const unitSetupTemplate = self.areas.unitEditorArea.find('#template-element');
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
    Object.keys(self.positions).forEach(positionKey => {
      const elem = unitSetupTemplate.clone();
      elem.attr('id', positionKey);
      elem.find('#position-text').text(self.positions[positionKey]);
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
              .dropdown('set text', 'N/A')
              .addClass('disabled');
          }
        },
      }).dropdown('set exactly', ['X',])
        .dropdown('save defaults');
      bbTypeDropdown
        .dropdown({
          onChange (value) { bbTypeDropdown.value = value; },
        }).dropdown('change values', [])
        .dropdown('set exactly', ['',])
        .dropdown('set text', 'N/A')
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
    self.areas.simResult = $('#sim-result-area');

    self.areas.simResult.hide();
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
            const possibleTypes = ['bb', 'sbb', 'ubb',];
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
