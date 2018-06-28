!function(t){var e={};function r(i){if(e[i])return e[i].exports;var o=e[i]={i:i,l:!1,exports:{}};return t[i].call(o.exports,o,o.exports,r),o.l=!0,o.exports}r.m=t,r.c=e,r.d=function(t,e,i){r.o(t,e)||Object.defineProperty(t,e,{configurable:!1,enumerable:!0,get:i})},r.r=function(t){Object.defineProperty(t,"__esModule",{value:!0})},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,"a",e),e},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.p="",r(r.s=3)}([function(t,e){var r;r=function(){return this}();try{r=r||Function("return this")()||(0,eval)("this")}catch(t){"object"==typeof window&&(r=window)}t.exports=r},function(t,e,r){(function(e){var r;r="function"==typeof Array.prototype.indexOf?function(t,e){return t.indexOf(e)}:function(t,e){for(var r=0,i=t.length,o=-1,n=!1;r<i&&!n;)t[r]===e&&(o=r,n=!0),r++;return o};var i=function(){this.events={}};i.prototype.on=function(t,e){"object"!=typeof this.events[t]&&(this.events[t]=[]),this.events[t].push(e)},i.prototype.removeListener=function(t,e){var i;"object"==typeof this.events[t]&&(i=r(this.events[t],e))>-1&&this.events[t].splice(i,1)},i.prototype.emit=function(t){var e,r,i,o=[].slice.call(arguments,1);if("object"==typeof this.events[t])for(i=(r=this.events[t].slice()).length,e=0;e<i;e++)r[e].apply(this,o)},i.prototype.once=function(t,e){this.on(t,function r(){this.removeListener(t,r),e.apply(this,arguments)})};try{t.exports=i}catch(t){}try{window.EventEmitter=i}catch(t){}try{self.EventEmitter=i}catch(t){}try{e.EventEmitter=i}catch(t){}}).call(this,r(0))},function(t,e){t.exports=function(t){return t.webpackPolyfill||(t.deprecate=function(){},t.paths=[],t.children||(t.children=[]),Object.defineProperty(t,"loaded",{enumerable:!0,get:function(){return t.l}}),Object.defineProperty(t,"id",{enumerable:!0,get:function(){return t.i}}),t.webpackPolyfill=1),t}},function(t,e,r){(function(t,e){const i=r(1),o={1:{"top-left":15,"top-right":30,"middle-left":20,"middle-right":40,"bottom-left":18,"bottom-right":33},2:{"top-left":13,"top-right":24,"middle-left":16,"middle-right":33,"bottom-left":15,"bottom-right":27},3:{"top-left":10,"top-right":19,"middle-left":13,"middle-right":26,"bottom-left":12,"bottom-right":21},4:{"top-left":7,"top-right":14,"middle-left":9,"middle-right":19,"bottom-left":8,"bottom-right":15},5:{"top-left":4,"top-right":9,"middle-left":6,"middle-right":12,"bottom-left":5,"bottom-right":9}},n={850328:19,750167:11,810278:25,810108:32,61007:48,860357:34,850418:30,20887:43,860258:21,850158:23,61087:17,51107:21,40857:15,860518:23,860548:20,51317:105,830048:18,61207:29};class s{constructor(t={}){this.movespeedOffsets=t.movespeedOffsets||o,this.teleporterData=t.teleporterData||n,this.getUnitFn=t.getUnit,this.sbbFrameDelay=2,this.eventEmitter=new i}on(t,e){this.eventEmitter.on(t,e)}onProgress(t){this.on("progress",t)}onDebug(t){this.on("debug",t)}async getUnit(t){return await Promise.resolve(this.getUnitFn(t))}static getSupportedTeleporters(){return Object.keys(n).map(t=>({id:t,delay:n[t]}))}static getPositionIndex(t=""){return["top-left","top-right","middle-left","middle-right","bottom-left","bottom-right"].indexOf(t)}getTeleporterOffset(t){return this.teleporterData[t.id.toString()]||0}getOriginalFramesForUnit(t,e,r){const i=["1","13","14","27","28","29","47","61","64","75","11000"].concat(["46","48","97"]),o=t[e]["damage frames"],n=t[e].levels[0].effects,s=+t.movement.skill["move type"];let a=(3===s?+t.movement.skill["move speed"]:0)+(2==+s?this.getTeleporterOffset(t):0);isNaN(r)||(a+=+r);let l=!0;const c=n.filter(t=>i.indexOf((t["proc id"]||t["unknown proc id"]||"").toString())>-1);return o.filter(t=>i.indexOf((t["proc id"]||t["unknown proc id"]||"").toString())>-1).map((t,e)=>{l="aoe"===c[e]["target area"];const r=+t["effect delay time(ms)/frame"].split("/")[1],i={};return t["frame times"].forEach(t=>{i[+t+(2===s?0:r)+a]=l?"aoe":"st"}),i})}async getUnitData(t={}){const e=await this.getUnit(t.id);return{name:e.name,moveType:+e.movement.skill["move type"],speedType:e.movement.skill["move speed type"].toString(),originalFrames:this.getOriginalFramesForUnit(e,t.type||"sbb",t.delay)}}getBattleFrames(t={}){if("X"===t.id||"E"===t.id)return{};const e=t.position,{name:r,moveType:i,speedType:n,originalFrames:s}=t.unitData;let a=(+t.bbOrder-1)*this.sbbFrameDelay+(1===i?o[n][e]:0);t.alias=t.alias||r;const l={};return s.forEach(t=>{Object.keys(t).forEach(e=>{const r=+e+a;l[r]||(l[r]={aoe:0,st:0}),l[r][t[e]]+=1})}),l}processSquad(t=[],e=6){const r={};t.forEach(t=>{const e=this.getBattleFrames(t);Object.keys(e).forEach(t=>{r[+t]||(r[+t]={aoe:0,st:0}),r[+t].aoe+=e[t].aoe,r[+t].st+=e[t].st}),t.battleFrames=e});let i=0,o=0;const n=t.map(t=>{let n=Object.keys(t.battleFrames).map(r=>t.battleFrames[+r].aoe*e+t.battleFrames[+r].st).reduce((t,e)=>t+e,0),s=Object.keys(t.battleFrames).map(i=>{const{aoe:o,st:n}=r[+i],[s,a]=[o-t.battleFrames[i].aoe,n-t.battleFrames[i].st],l=t.battleFrames[i].aoe>0&&s>0,c=t.battleFrames[i].st>0&&a>0||t.battleFrames[i].st>0&&s>0||t.battleFrames[i].aoe>0&&a>0&&!l;let d=0;return l&&(d+=t.battleFrames[i].aoe*e),c&&(d+=Math.max(t.battleFrames[i].st,1)),d}).reduce((t,e)=>t+e,0);i+=n,o+=s;return{id:t.id,alias:t.alias||{X:"(Any)",E:"(Empty)"}[t.id],position:t.position,bbOrder:t.bbOrder,type:t.type,actualSparks:s,possibleSparks:n,delay:t.delay}}),s=n.filter(t=>t.possibleSparks>0).map(t=>t.actualSparks/t.possibleSparks),a=s.map(t=>t*(1/s.length)).reduce((t,e)=>t+e,0);return{actualSparks:o,possibleSparks:i,weightedPercentage:a,squad:n}}getAllPermutations(t=[]){const e=[];return 1===t.length?(e.push(t),e):(t.forEach((r,i)=>{const o=t.slice(0,i).concat(t.slice(i+1,t.length));this.getAllPermutations(o).forEach(t=>{e.push([r].concat(t))})}),e)}generateUnitKey(t){return"X"===t.id||"E"===t.id?"":`${t.id}|${t.type}|${t.position}|${t.bbOrder}`}generateSquadKey(t){return t.sort((t,e)=>t.bbOrder-e.bbOrder).map(this.generateUnitKey).filter(t=>!!t).join("-")}findBestOrders(t=[],e=.5,r=10,i){this.eventEmitter.emit("debug",{text:"entered findBestOrders",args:arguments});const o=[1,2,3,4,5,6],n=t.filter(t=>"E"===t.id),s=[],a=[];t.forEach(t=>{!isNaN(t.bbOrder)&&o.indexOf(t.bbOrder)>-1?s.push(t):"E"!==t.id&&a.push(t)});const l=o.filter(t=>t>6-n.length).map((t,e)=>({bbOrder:t,...n[e]})),c=s.map(t=>+t.bbOrder),d=o.filter(t=>-1===c.indexOf(t)&&t<=6-n.length),p=this.getAllPermutations(d);let h=[];if(p.length>0)p.forEach(t=>{const r=t.map((t,e)=>{if(a[e])return{...a[e],bbOrder:t}}).filter(t=>!!t).concat(s).concat(l),o=this.generateSquadKey(r);if(!i[o]){const t=this.processSquad(r);t.weightedPercentage>=e&&h.push(t),i[o]=!0}});else{const t=this.processSquad(s.concat(l));t.weightedPercentage>=e&&h.push(t)}return h.sort((t,e)=>e.weightedPercentage-t.weightedPercentage).slice(0,r)}findBestPositions(t=[],e=.5,r=10){const i=["top-left","top-right","middle-left","middle-right","bottom-left","bottom-right"],o={},n=[],s=[];t.forEach(t=>{t.position&&i.indexOf(t.position)>-1?n.push(t):s.push(t)});const a=n.map(t=>t.position),l=i.filter(t=>-1===a.indexOf(t)),c=this.getAllPermutations(l);let d=0,p=[];if(c.length>0)c.forEach(t=>{const i=t.map((t,e)=>{if(s[e])return{...s[e],position:t}}).filter(t=>!!t).concat(n);this.eventEmitter.emit("debug",{text:"about to enter findBestOrders",args:[i,e,r,o]}),this.findBestOrders(i,e,r,o).forEach(t=>{t.weightedPercentage>=e&&p.push(t)});const a=++d/c.length*100,l=`Finding Positions: ${a.toFixed(2)}% complete (${c.length-d} remaining)`;this.eventEmitter.emit("progress",{percentComplete:a,complete:d,total:c.length,message:l})});else{this.findBestOrders(n,e,r,o).forEach(t=>{t.weightedPercentage>=e&&p.push(t)})}return p.sort((t,e)=>e.weightedPercentage-t.weightedPercentage).slice(0,r)}async preProcessSquad(t=[]){const e=t.filter(t=>"X"===t.id),r=t.filter(t=>"E"===t.id),i=Math.max(0,...t.filter(t=>void 0!==t.bbOrder).map(t=>t.bbOrder));if(!Array.isArray(t))throw Error("Input must be an array");if(6!==t.length)throw Error("Squad length must be 6");if(e.length+r.length>4)throw Error("Must have at least 2 actual units in squad");if(r.filter(t=>!t.position).length>1)throw Error("Must have position satisfied for every empty unit");if(r.filter(t=>void 0!==t.bbOrder).length>0)throw Error("Empty units must not have any BB Order");if(i>6-r.length)throw Error(`BB Order cannot exceed number of non-empty units (${6-r.length})`);const o=[];t.forEach(t=>{if("X"!==t.id&&"E"!==t.id){const e=this.getUnitData(t).then(e=>{t.unitData=e});o.push(e)}});try{await Promise.all(o)}catch(t){throw t}}async run(t=[],e={}){const{threshold:r,sortResults:i,maxResults:o}=e;await this.preProcessSquad(t);const n=this.findBestPositions(t,r,o);return i&&n.forEach(t=>{t.squad.sort((t,e)=>s.getPositionIndex(t.position)-s.getPositionIndex(e.position))}),n}}t&&t.exports&&(t.exports=s);try{window.SparkSimulator=s}catch(t){}try{self.SparkSimulator=s}catch(t){}try{e.SparkSimulator=s}catch(t){}}).call(this,r(2)(t),r(0))}]);