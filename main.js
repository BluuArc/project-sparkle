//Source Reddit post: https://www.reddit.com/r/bravefrontier/comments/64f730/automatic_sparking_simulator_version_10/
//Original Python Code (from Reddit Post above): https://drive.google.com/file/d/0B4cWakT3Wj70alVGTk1BQ2NYWkE/view

var fs = require('fs');
var underscore = require('underscore'); 
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var itertools = require('itertools');

function Unit(move_type,speed_type,effect_delay,frames){
    this.move_type = move_type;
    this.speed_type = speed_type;
    this.effect_delay = effect_delay;
    this.frames = frames;
}

/* Begin Python port; originally by Hamza */
//default units
var units = {
    "Lasswell": new Unit(1, 4, 1, [33, 36, 39, 42, 51, 54, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108]),
    "Azurai": new Unit(3, 9999, 6, [99, 108, 117, 123, 126, 132, 138, 141, 144, 147, 150, 153]),
    "Regil": new Unit(1, 4, 1, [11, 14, 17, 20, 38, 41, 44, 47, 50, 53, 56, 86, 90, 94, 98, 102, 106, 110, 114]),
    "Silvie": new Unit(1, 3, 1, [69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 129, 132, 135, 138, 141]),
    "Long": new Unit(1, 3, 1, [18, 21, 24, 27, 30, 33, 36, 39]),
    "Lauda": new Unit(1, 4, 3, [56, 59, 62, 65, 68, 71, 74, 77, 80, 83, 86, 89, 92, 95, 98, 101, 104, 107, 110, 113, 116, 119, 122, 125, 128, 131, 134, 137, 140]),
    "Lid": new Unit(1, 3, 1, [40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70, 73, 76, 79, 82, 85, 88, 91, 94, 97, 100, 103, 106, 109, 112, 115, 118, 121]),
    "Hisui": new Unit(1, 3, 4, [39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84]),
    "Ensa": new Unit(3, 9999, 0, [91, 94, 97, 100, 103, 106, 109, 112, 115, 118, 121, 124, 127, 130, 133, 136, 139, 142, 145, 148, 151, 154, 157, 160]),
    "Rain": new Unit(1, 3, 1, [15, 18, 21, 24, 27, 46, 49, 52, 55, 74, 77, 80, 83, 86, 89, 92, 95, 98]),
    "Feng": new Unit(1, 3, 1, [21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 69, 72, 75, 78, 81, 86, 87, 90, 93, 99, 105, 111, 117, 123]),
    "Melord": new Unit(1, 3, 3, [74, 77, 80, 83, 86, 89, 92, 95, 98, 101, 104, 107, 110, 113, 116, 119, 122, 125]),
    "Zekuu": new Unit(1, 3, 1, [34]),
    "Zeruiah": new Unit(1, 3, 1, [35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71, 74, 77, 80, 83, 86, 89, 92, 95, 98, 101, 104, 107, 110, 113, 116, 119, 122, 125, 128, 131, 134, 137, 140, 143, 146, 149, 152, 155, 158, 161, 164, 167]),
    "Elza": new Unit(1, 4, 2, [15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 129, 132, 135, 138])
};

var speed3_frames = { "a": 9, "b": 18, "c": 12, "d": 25, "e": 11, "f": 20 }
var speed4_frames = { "a": 6, "b": 13, "c": 8, "d": 18, "e": 7, "f": 14 }

var sbb_frame_delay = 2 //Set to 2 for no BB cutoff

var threshold = 50.0 //excludes all positionings/ orders with total percentage of sparks below the threshold
var max_threshold = threshold;

function getFrameRates(name, position, order) { //name = string,position = string "a" or "b" etc, order = number SBB from 1 to 6
    if(name == "X"){
        return [];
    }
    //get data about unit
    var unit_info = units[name];
    var move_type = unit_info.move_type;
    var speed_type = unit_info.speed_type;
    var effect_delay = unit_info.effect_delay;
    var frames = unit_info.frames;

    var frame_delay = (order - 1) * sbb_frame_delay;

    if (move_type == 1)      //moving unit
        if (speed_type == 3)
            frame_delay = frame_delay + effect_delay + speed3_frames[position];
        else if(speed_type == 4)
            frame_delay = frame_delay + effect_delay + speed4_frames[position];
        //else                   //move types 1, 2, 5 are currently not supported
            //do nothing
    else if (move_type == 3)    //stationary unit
        frame_delay = frame_delay + effect_delay;
    // else                   //teleporting unit (type 2)
        //do nothing

    //calculate frame rates
    var frame_rates = [];
    for(x in frames){
        frame_rates.push(frames[x] + frame_delay);
    }
    return frame_rates;
}

function findOverlap(frames1, frames2) {//given two lists of frames, return list in format [frames hit, total frames]
    var frames_hit = 0;
    for(x in frames1){
        frames_hit += (frames2.indexOf(frames1[x]) > -1) ? 1 : 0;
        // if(frames2.indexOf(frames1[x])){
        //     frames_hit += 1;
        // }
    }
    var total_frames = frames1.length;

    return {frames_hit,total_frames};
}

function getPositionChar(index){
    switch(index){
        case 0: return 'a';
        case 1: return 'b';
        case 2: return 'c';
        case 3: return 'd';
        case 4: return 'e';
        case 5: return 'f';
        case 6: return 'g';
        default:
        return 'a';
    }
}

//units ["unit a","unit b",...] follows top-most format for positioning, unit_orders like [1,3,4,6,5,2]
//returns [% sparked, inputs, and list of sparked hits for each unit]
function findSparks(units, unit_orders, weights, original_units){
    var og_units = original_units.slice();
    var weights_copy = weights.slice();
    var orderedWeights = [];
    for(x in units){
        var index = og_units.indexOf(units[x]);
        orderedWeights = orderedWeights.concat(weights_copy.splice(index,1));
        og_units.splice(index);
    }
    

    var frames = [];
    for(x in units){
        var curPosition = getPositionChar(x);
        var newFrameVal = getFrameRates(units[x],curPosition,unit_orders[x]);
        frames.push(newFrameVal);
    }

    var sparks = [];
    for(x in units){
        //remove currrent frame from array
        var tempSubList = frames.slice(0,x).concat(frames.slice(x+1));
        //concatenate rest of frames
        var tempMainList = [];
        for(l in tempSubList){
            tempMainList = tempMainList.concat(tempSubList[l]);
        }
        
        var newSparkVal = findOverlap(frames[x],tempMainList);
        sparks.push(newSparkVal);
    }


    var relevantWeights = 0
    for(x in orderedWeights){
        relevantWeights += (sparks[x].total_frames != 0) ? orderedWeights[x] : 0;
    }

    var percent_sparks = 0.0;
    for(a in sparks){
        if(sparks[a].total_frames != 0){
            percent_sparks += ((sparks[a].frames_hit / sparks[a].total_frames) * (orderedWeights[a]/relevantWeights));
        }
    }
    percent_sparks *= 100;

    var result = {
        percent_sparks: percent_sparks,
        inputs: {
            units: units,
            unit_orders: unit_orders
        },
        sparks: sparks
    };
    return result;
}

//source for permutation: http://stackoverflow.com/questions/9960908/permutations-in-javascript/20871714#20871714
/*
ex: input is permutator(['c','a','t']);
ex: output is [ [ 'c', 'a', 't' ],
['c', 't', 'a'],
    ['a', 'c', 't'],
    ['a', 't', 'c'],
    ['t', 'c', 'a'],
    ['t', 'a', 'c'] ]
*/
const permutator = (inputArr) => {
    let result = [];

    const permute = (arr, m = []) => {
        if (arr.length === 0) {
            result.push(m)
        } else {
            for (let i = 0; i < arr.length; i++) {
                let curr = arr.slice();
                let next = curr.splice(i, 1);
                permute(curr.slice(), m.concat(next))
            }
        }
    }

    permute(inputArr)

    return result;
}



//given positioning of units, outputs a sorted list of all possible SBB orders, from least % sparks to most 
function findBestOrder(units, weights, original_units){
    var all_positions = [];
    var permute = [];
    var permute_sum = 0;
    for (x in units) { //1 for each unit that's not "X", 0 for each "X" (no need to permute those for ordering)
        var newVal = (units[x] != "X") ? 1 : 0;
        permute.push(newVal);
        permute_sum += newVal;
    }
    
    var permutations = itertools.permutationsSync(underscore.range(1,units.length + 1),permute_sum);
    // var permutations = permutator([1, 2, 3, 4, 5, 6]);
    for(x in permutations){
        var curOrders = permutations[x].slice();
        var orderList = [];
        for(r in units){
            var newVal = (permute[r] == 1) ? curOrders.shift() : 0;
            orderList.push(newVal);
        }
        var s = findSparks(units, orderList,weights,original_units);
        if(s.percent_sparks >= threshold){
            if(s.percent_sparks >= max_threshold){
                max_threshold = s.percent_sparks;
            }
            all_positions.push(s);
        }
    }
    all_positions.sort(function(x,y){
        return (roundFloat(x.percent_sparks) - roundFloat(y.percent_sparks));
    });
    return all_positions;
}

function roundFloat(input){
    return Math.round(input*100.0) / 100.0;
}

function findBestSetup(units, weights) { //given set of units, finds best order of positioning and outputs list of positioning+order for sparking (from least to most % sparks)
    var all_orders = [];
    // var permutations = uniquePermutations(units);
    var permutations = permutator(units);
    for(x in permutations){
        all_orders = all_orders.concat(findBestOrder(permutations[x],weights,units));
    }

    all_orders.sort(function(x,y){
        return (roundFloat(y.percent_sparks) - roundFloat(x.percent_sparks));
    });
    return all_orders;
}

function uniquePermutations(list){
    if(list.length == 1){
        return [list];
    }else{
        var output = [];
        for(elem in list){
            //create a copy of the list w/o the current elem
            var copy = [];
            for(x in list){
                if(x != elem){
                    copy.push(list[x]);
                }
            }

            //recursively create output
            var newUnique = uniquePermutations(copy);
            for(y in newUnique){
                output.push(newUnique[y].concat(list[elem]));
            }
        }
        return output;
    }
}

function run(units){
    // var best = findBestPositions(units);
    var weights = [];
    for(x in units){
        weights.push(1);
    }
    var best = findBestSetup(units,weights);
    var numBest = 0;
    for(x in best){
        numBest++;
        var curOrder = best[x];

        /*
            Percentage
            Name: position - (spark/total)      Name: position - (spark/total)
            Name: position - (spark/total)      Name: position - (spark/total)
            Name: position - (spark/total)      Name: position - (spark/total)
        */

        console.log(curOrder.percent_sparks.toFixed(2).toString() + "%");
        var i = 0;
        var msg = "";
        for(i = 0; i < 6; ++i){
            msg += curOrder.inputs.units[i] + ": " + curOrder.inputs.unit_orders[i] + " - (" + curOrder.sparks[i].frames_hit + "/" + curOrder.sparks[i].total_frames + ")";
            if(i % 2 == 0){
                msg += "\t\t";
            }else{
                msg += "\n";
            }
        }
        msg += "\n";
        console.log(msg);
        if(numBest == 9){
            console.log("...and " + (best.length - numBest) + " more.");
            break;
        }
    }
    console.log("Max: " + max_threshold);
}

/* End Python port; originally by Hamza */

//take a unit directly from the database and convert it to the unit format needed here
//burst type is bb, sbb, or ubb
function convertUnit(db_unit, burst_type){
    var move_type = db_unit["movement"]["skill"]["move type"];
    var speed_type = db_unit["movement"]["skill"]["move speed type"];


    /* TODO:
        add option to combine frame for units with dual attacks
        add way to handle units with no attacking burst

    */

    var effect_delay, frames;
    if(db_unit[burst_type] != undefined){
        var raw_delay = db_unit[burst_type]["damage frames"][0]["effect delay time(ms)/frame"]; //e.g. 16.7/1
        frames = db_unit[burst_type]["damage frames"][0]["frame times"];
    }if(db_unit["sbb"] != undefined){
        var raw_delay = db_unit["sbb"]["damage frames"][0]["effect delay time(ms)/frame"]; //e.g. 16.7/1
        // effect_delay = raw_delay.split('/')[1];
        frames = db_unit["sbb"]["damage frames"][0]["frame times"];
    }else if(db_unit["bb"] != undefined){
        var raw_delay = db_unit["bb"]["damage frames"][0]["effect delay time(ms)/frame"]; //e.g. 16.7/1
        // effect_delay = raw_delay.split('/')[1];
        frames = db_unit["bb"]["damage frames"][0]["frame times"];
    }
    effect_delay = raw_delay.split('/')[1];

    return new Unit(move_type,speed_type,effect_delay,frames);
    
}

//load a local database of units and return the unit id
function getUnitLocal(id){
    var unit_file = fs.readFileSync("./info-gl.json");
    var unit_db = JSON.parse(unit_file);
    return unit_db[id];
}

//temporary function to generate all OE units currently available (if they exist in the database)
//to be removed once front end is fully implemented
function generateOEUnits(){
    var oe = [10017, 10127, 10557, 10677, 10717, 10737, 10757, 10847, 10897, 10917, 10937, 10947, 10977, 10997, 11017, 11027, 11037, 11047, 11057, 20017, 20157, 20537, 20567, 20637, 20677, 20797, 20817, 20827, 20837, 20857, 20877, 20887, 20907, 20927, 20947, 20967, 20977, 20987, 20997, 30017, 30447, 30517, 30567, 30787, 30797, 30817, 30837, 30847, 30867, 30877, 30897, 30907, 30917, 30927, 30947, 40017, 40507, 40537, 40577, 40767, 40787, 40817, 40827, 40857, 40867, 40877, 40887, 40897, 40907, 40917, 50017, 50287, 50477, 50657, 50757, 50917, 50987, 50997, 51007, 51027, 51037, 51047, 51067, 51087, 51107, 51127, 51137, 51147, 51157, 51167, 51187, 60017, 60027, 60117, 60527, 60667, 61007, 61017, 61027, 61037, 61047, 61057, 61067, 61087, 61097, 61107, 61117, 710197, 710217, 720107, 720157, 720197, 720227, 730227, 730237, 730247, 740197, 740227, 750157, 750167, 750197, 750237, 760017, 760227, 810108, 810178, 810278, 810338, 810357, 810398, 810418, 810508, 820158, 820168, 820178, 820388, 820398, 820418, 830118, 830178, 830188, 830278, 830418, 830518, 840128, 840178, 840278, 840368, 840398, 840418, 840508, 850158, 850167, 850178, 850198, 850368, 850398, 850418, 860128, 860158, 860167, 860178, 860238, 860258, 860278, 860357, 860368, 860428];
    var msg = "";
    for(unit in oe){
        var curUnit = getUnitLocal(oe[unit].toString());
        
        msg = "";
        if(curUnit != undefined){
            msg += curUnit["name"] + ": ";
            msg += JSON.stringify(convertUnit(curUnit,"sbb"));
        }else{
            msg += "Cannot find " + oe[unit];
        }
        console.log(msg);
    }
}

//temporary function to see list of current units
//to be removed once front end is fully implemented
function getAvailableUnits(){
    var msg = "";
    for(u in units){
        msg += u + "\n";
    }
    return msg;
}

//temporary function to load temporary JSON file
//to be removed once front end is fully implemented
function loadOEUnits(){
    var unit_file = fs.readFileSync("./oe_units.json");
    units = JSON.parse(unit_file);
}


app.get('/', function (req, res) {
    res.sendFile(__dirname + "/local.html");
})


server.listen(8081, '127.0.0.1', function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Application listening at http://%s:%s", host, port);
});

// use the following for the default values listed above
run(["Lasswell", "Silvie", "Lauda", "Lid", "Elza", "Hisui"]);

//use the following if loading from a file
// loadOEUnits();
// run(["Lasswell", "Silent Sentinel Silvie", "Ideal Subject Lauda", "Lid", "Graceful Princess Elza","Heavenly Spiral Hisui"]);