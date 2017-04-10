//Source Reddit post: https://www.reddit.com/r/bravefrontier/comments/64f730/automatic_sparking_simulator_version_10/
//Original Python Code (from Reddit Post above): https://drive.google.com/file/d/0B4cWakT3Wj70alVGTk1BQ2NYWkE/view

var fs = require('fs');
var underscore = require('underscore'); 
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

function Unit(move_type,speed_type,effect_delay,frames){
    this.move_type = move_type;
    this.speed_type = speed_type;
    this.effect_delay = effect_delay;
    this.frames = frames;
}

var units = {
    "Lasswell": new Unit(1, 4, 1, [33, 36, 39, 42, 51, 54, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108]),
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

var threshold = 90.0 //excludes all positionings/ orders with total percentage of sparks below the threshold

function getFrameRates(name, position, order) { //name = string,position = string "a" or "b" etc, order = number SBB from 1 to 6
    var unit_info = units[name];
    // console.log(unit_info);
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
    else if (move_type == 2)    //teleporting unit
        frame_delay = frame_delay + effect_delay;
    // else                   //stationary unit (type 3)
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
        if(frames2.indexOf(frames1[x])){
            frames_hit += 1;
        }
    }
    var total_frames = frames1.length;

    return {frames_hit,total_frames};
}

//units ["unit a","unit b",...] follows top-most format for positioning, unit_orders like [1,3,4,6,5,2]
//returns [% sparked, inputs, and list of sparked hits for each unit]
function findSparks(units, unit_orders){
    var frames1 = getFrameRates(units[0], "a", unit_orders[0]);
    var frames2 = getFrameRates(units[1], "b", unit_orders[1]);
    var frames3 = getFrameRates(units[2], "c", unit_orders[2]);
    var frames4 = getFrameRates(units[3], "d", unit_orders[3]);
    var frames5 = getFrameRates(units[4], "e", unit_orders[4]);
    var frames6 = getFrameRates(units[5], "f", unit_orders[5]);
    
    var sparks1 = findOverlap(frames1, frames2.concat(frames3,frames4,frames5,frames6));
    var sparks2 = findOverlap(frames2, frames1.concat(frames3,frames4,frames5,frames6));
    var sparks3 = findOverlap(frames3, frames1.concat(frames2,frames4,frames5,frames6));
    var sparks4 = findOverlap(frames4, frames1.concat(frames2,frames3,frames5,frames6));
    var sparks5 = findOverlap(frames5, frames1.concat(frames2,frames3,frames4,frames6));
    var sparks6 = findOverlap(frames6, frames1.concat(frames2,frames3,frames4,frames5));
    var percent_sparks = 0.0;
    percent_sparks += sparks1.frames_hit / sparks1.total_frames;
    percent_sparks += sparks2.frames_hit / sparks2.total_frames;
    percent_sparks += sparks3.frames_hit / sparks3.total_frames;
    percent_sparks += sparks4.frames_hit / sparks4.total_frames;
    percent_sparks += sparks5.frames_hit / sparks5.total_frames;
    percent_sparks += sparks6.frames_hit / sparks6.total_frames;
    percent_sparks /= 6.0;
    percent_sparks *= 100.0;

    var result = {
        percent_sparks: percent_sparks,
        inputs: {
            units: units,
            unit_orders: unit_orders
        },
        sparks: [sparks1, sparks2, sparks3, sparks4, sparks5, sparks6]
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
function findBestOrder(units){
    var all_positions = [];
    var permutations = permutator([1, 2, 3, 4, 5, 6]);
    for(x in permutations){
        var s = findSparks(units, permutations[x]);
        // console.log(s.percent_sparks)
        if(s.percent_sparks >= threshold){
            // console.log(s);
            all_positions.push(s);
        }
    }
    all_positions.sort(function(x,y){
        return x.percent_sparks - y.percent_sparks;
    });
    // console.log(all_positions);
    return all_positions;
}

function findBestPositions(units) { //given set of units, finds best order of positioning and outputs list of positioning+order for sparking (from least to most % sparks)
    var all_orders = [];
    var permutations = permutator(units);
    for(x in permutations){
        all_orders = all_orders.concat(findBestOrder(permutations[x]));
    }
    all_orders.sort(function(x,y){
        return x.percent_sparks - y.percent_sparks;
    });
    // console.log(all_orders);
    return all_orders;
}

function run(units){
    var best = findBestPositions(units);
    // console.log(best);
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
}

app.get('/',function(req,res){
    res.sendFile(__dirname + "/local.html");
})


server.listen(8081, '127.0.0.1', function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Application listening at http://%s:%s", host,port);
});

run(["Lasswell", "Silvie", "Lauda", "Lid", "Elza", "Hisui"]);