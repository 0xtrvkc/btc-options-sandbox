const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'HTML IDs are unique');
const nodes={};const canvas=new Proxy({measureText:()=>({width:40})},{get:(o,k)=>k in o?o[k]:(...args)=>{if(['moveTo','lineTo','arc','fillRect','clearRect'].includes(k))assert(args.filter(x=>typeof x==='number').every(Number.isFinite),'finite canvas '+k);}});
for(const id of ids)nodes[id]={id,value:'',innerHTML:'',textContent:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},hasAttribute(){return false;},querySelectorAll(){return[];},querySelector(){return null;},checkValidity(){return true;},reportValidity(){return true;},getBoundingClientRect(){return{width:600,height:315};},getContext(){return canvas;}};
for(const m of html.matchAll(/<input\b([^>]+)>/g)){const id=m[1].match(/\bid="([^"]+)"/)?.[1],v=m[1].match(/\bvalue="([^"]*)"/)?.[1];if(id)nodes[id].value=v||'';}
for(const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const opts=[...m[2].matchAll(/<option\b([^>]*)>/g)],pick=opts.find(x=>/selected/.test(x[1]))||opts[0];nodes[m[1]].value=pick?.[1].match(/value="([^"]+)"/)?.[1]||'';}
let stored={};const ctx={console,Date,Math,Number,Map,Set,WeakMap,JSON,String,Array,Intl,AbortSignal,performance,URL,document:{getElementById:id=>{assert(nodes[id],'missing ID '+id);return nodes[id];},querySelectorAll:()=>[],documentElement:{dataset:{}}},window:{devicePixelRatio:1,addEventListener(){},innerWidth:1280,innerHeight:900},getComputedStyle:()=>({getPropertyValue:()=> '#aaa'}),localStorage:{getItem:k=>stored[k],setItem:(k,v)=>stored[k]=v},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,fetch:async()=>{throw Error('offline test');}};
vm.createContext(ctx);const names=[...script.matchAll(/(?:async )?function (\w+)\(/g)].map(x=>x[1]);const tail=script.indexOf('let rt;window.addEventListener');assert(tail>0);vm.runInContext(script.slice(0,tail)+'Object.assign(globalThis,{state,HELP_TEXT,'+names.join(',')+'});})();',ctx);
const DAY=86400000,HOUR=3600000;let count=0;function test(name,fn){fn();count++;console.log('PASS',name);}function near(a,b,t=1e-8){assert(Math.abs(a-b)<t,`${a} ≈ ${b}`);}
function seed(){ctx.state.daily=Array.from({length:900},(_,i)=>({ts:Date.UTC(2022,0,1)+i*DAY,close:100000*Math.exp(.02*Math.sin(i/7)+.0001*i),low:100000*Math.exp(.02*Math.sin(i/7)+.0001*i),high:100000*Math.exp(.02*Math.sin(i/7)+.0001*i)}));ctx.state.intraday=[];for(const d of ctx.state.daily)for(let h=0;h<24;h+=4)ctx.state.intraday.push({ts:d.ts+h*HOUR,close:d.close,high:d.close,low:d.close});ctx.state.intradayHours=4;ctx.state.latest=ctx.state.daily.at(-1);ctx.state.latestIntraday=ctx.state.intraday.at(-1);ctx.computeFeatures();}
seed();
test('session statistics stay visible and historical cases use a doubled viewport',()=>{assert(html.includes('aria-labelledby="sessionStatsTitle"'));assert(!html.includes('<summary>Session statistics and applied research range</summary>'));assert(html.includes('#historicalCases>.table-wrap{max-height:840px}'));assert(script.includes("reverse().slice(0,440)"));});
test('numeric defaults satisfy declared bounds and steps',()=>{for(const m of html.matchAll(/<input\b([^>]+)>/g)){const a=Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));if(a.type!=='number'||!a.value)continue;const v=Number(a.value);assert(Number.isFinite(v),a.id);if(a.min!==undefined)assert(v>=Number(a.min),a.id);if(a.max!==undefined)assert(v<=Number(a.max),a.id);if(a.step!=='any'){const n=(v-Number(a.min??a.value??0))/Number(a.step??1);near(n,Math.round(n));}}});
test('completed 4H bar cannot supply an unfinished close',()=>{const a=[{ts:0,close:1},{ts:4*HOUR,close:2}];assert.equal(ctx.completedBar(a,2*HOUR,4*HOUR),null);assert.equal(ctx.completedBar(a,6*HOUR,4*HOUR).close,1);assert.equal(ctx.completedBar(a,8*HOUR,4*HOUR).close,2);});
test('daily feature uses prior completed bucket',()=>{const d=ctx.state.daily,mark=d[300].ts+16*HOUR;assert.equal(ctx.featureBefore(mark).index,299);assert.equal(ctx.featureBefore(d[300].ts+DAY).index,300);});
test('path coverage rejects missing buckets and unaligned windows',()=>{const a=[{ts:0,close:1},{ts:4*HOUR,close:2}];assert(ctx.completeSessionPath(a,0,8*HOUR,4*HOUR,1));assert.equal(ctx.completeSessionPath(a.slice(0,1),0,8*HOUR,4*HOUR,1),null);assert.equal(ctx.completeSessionPath(a,0,7*HOUR,4*HOUR,1),null);});
test('normalizer rejects nonpositive prices and conflicting duplicates',()=>{const a=ctx.normalize([{date:'2024-01-01',close:1},{date:'2024-01-01',close:2},{date:'2024-01-02',close:-1},{date:'2024-01-03',close:3}]);assert.equal(a.length,1);assert.equal(a[0].close,3);assert.equal(a.audit.conflicts,1);});
test('intraday constructors exclude unaligned entry and gaps',()=>{const s={...ctx.settings(),regime:'all'};assert(ctx.makeIntradayBase(s).length>100);assert.equal(ctx.makeIntradayBase({...s,entryHour:1}).length,0);const before=ctx.makeIntradayBase(s);const idx=ctx.state.intraday.findIndex(x=>x.ts===before[0].entryTs);const removed=ctx.state.intraday.splice(idx,1)[0];assert.equal(ctx.makeIntradayBase(s).length,before.length-1);ctx.state.intraday.splice(idx,0,removed);});
test('multi-day records use actual close availability and full tenor',()=>{const x=ctx.makeMultiDayBase({...ctx.settings(),mode:'multi',expiry:7})[0];assert.equal(x.entryTs,x.entryBucketTs+DAY);assert.equal(x.expiryTs-x.entryTs,7*DAY);assert.equal(x.entry,ctx.state.daily.find(d=>d.ts===x.entryBucketTs).close);});
test('RV excludes future candles and requires 30 complete returns',()=>{const d=ctx.state.daily,mark=d[100].ts,v=ctx.preEntryDeltaVol(mark);const old=d[100].close;d[100].close=1e9;near(v,ctx.preEntryDeltaVol(mark));d[100].close=old;assert(Number.isNaN(ctx.preEntryDeltaVol(d[29].ts)));const oldts=d[90].ts;d[90].ts+=HOUR;assert(Number.isNaN(ctx.preEntryDeltaVol(mark)));d[90].ts=oldts;});
test('minimum-width interval covers target even for one-sided samples',()=>{for(const r of [[1,2,3,4,5],[-5,-4,-3,-2,-1],[-8,-1,0,1,9]]){const x=ctx.minWidthRange(r,.8);assert(r.filter(v=>v>=x.lo&&v<=x.hi).length>=4);assert(x.lo<=0&&x.hi>=0);}});
test('delta inversion and put-call parity',()=>{for(const type of ['put','call'])for(const target of [.01,.25,.49]){const K=ctx.entryDeltaStrike(100000,8/8760,.03,.55,target,type),d=ctx.bsGreeks(100000,K,8/8760,.03,.55,type);near(d.delta,type==='put'?-target:target);}near(ctx.bsGreeks(100,100,.1,0,.5,'call').delta-ctx.bsGreeks(100,100,.1,0,.5,'put').delta,1);assert.equal(ctx.bsGreeks(100,0,.1,0,.5,'put').gamma,0);});
test('scenario accounting matches independent payoff formulas',()=>{ctx.state.range={lo:-2,hi:2};for(const mode of ['covered','csp','defined'])for(const terminal of [0,50,99,101,150,1000]){const s={strategy:'strangle',capitalMode:mode,credit:1,wing:5},u=ctx.scenarioTerms(100,terminal,s);let opt=1-Math.max(98-terminal,0);if(mode!=='csp')opt-=Math.max(terminal-102,0);if(mode==='defined')opt+=Math.max(93-terminal,0)+Math.max(terminal-107,0);near(u.optionPnl,opt);near(u.structurePnl,opt+(mode==='covered'?terminal-100:0));assert(u.capital>0);}});
test('scenario performance compounds only sequential valid returns',()=>{ctx.state.range={lo:-2,hi:2};const s={strategy:'strangle',capitalMode:'csp',credit:1,wing:5},a=[0,7,14].map(d=>({entryTs:d*DAY,expiryTs:d*DAY+HOUR,entry:100,expiry:100})),p=ctx.scenarioPerformance(a,s),r=1/98;near(p.meanReturn,r);near(p.equity,Math.pow(1+r,3));assert(Number.isFinite(p.cagr));assert.equal(p.overlaps,0);assert.equal(p.profitFactor,Infinity);const overlap=ctx.scenarioPerformance([{...a[0],expiryTs:8*DAY},a[1]],s);assert.equal(overlap.overlaps,1);assert.equal(overlap.compoundable,false);assert(Number.isNaN(overlap.cagr));});
test('expired model horizon is zero, not reset to full tenor',()=>{const original=ctx.Date;class Frozen extends Date{static now(){return Date.UTC(2024,0,5,9);}}ctx.Date=Frozen;assert.equal(ctx.modelHorizonYears({mode:'friday0dte',entryHour:0,expiryHour:8,sessionHours:8}),0);ctx.Date=original;});
function quoteFixture(){const base=[],rows=[];for(let i=0;i<120;i++){const entryTs=Date.UTC(2021,0,1+i*7),expiryTs=entryTs+8*HOUR;base.push({entryTs,expiryTs});for(const target of [.2,.3])rows.push({entryTime:new Date(entryTs).toISOString(),expiryTime:new Date(expiryTs).toISOString(),entrySpot:100,expirySpot:i%10===0?95:100,putStrike:target===.2?90:98,callStrike:target===.2?110:102,putPremium:target===.2?.2:2,callPremium:target===.2?.2:2,putCosts:.01,callCosts:.01,putTarget:target,callTarget:target});}return{base,raw:{convention:'usd-linear-per-btc',pricingBasis:'executable-bid',source:'synthetic regression fixture',rows}};}
test('quote contribution sum, capital and costs',()=>{const x=quoteFixture().raw.rows[0],o=ctx.quoteOutcome(x,false),m=ctx.quoteMetrics([x],false);near(m.ret,m.optionReturn+m.backingReturn);near(o.optionReturn,(.4-.02)/190);assert.throws(()=>ctx.validateObjectiveQuotes({convention:'btc-inverse',source:'x',rows:[x]}));});
test('final holdout cannot change selected quote candidate',()=>{const {base,raw}=quoteFixture(),q=ctx.quoteComparison(ctx.validateObjectiveQuotes(raw),base,.3,false);assert(q.profit);assert(q.validationN>=10);const changed=JSON.parse(JSON.stringify(raw));for(const r of changed.rows)if(Date.parse(r.entryTime)>=base[84].entryTs){r.putPremium=r.putTarget===.2?50:0;r.callPremium=0;}const q2=ctx.quoteComparison(ctx.validateObjectiveQuotes(changed),base,.3,false);assert.equal(q.profit.policy,q2.profit.policy);assert.notEqual(q.profit.test.ret,q2.profit.test.ret);});
test('quote data duplicate and units checks',()=>{const {raw}=quoteFixture();assert.throws(()=>ctx.validateObjectiveQuotes({...raw,rows:[raw.rows[0],raw.rows[0]]}));assert.throws(()=>ctx.validateObjectiveQuotes({...raw,rows:[{...raw.rows[0],callPremium:101}]}));});
test('quote selection rejects mark or unspecified pricing',()=>{const {raw}=quoteFixture();assert.throws(()=>ctx.validateObjectiveQuotes({...raw,pricingBasis:'mark'}));assert.throws(()=>ctx.validateObjectiveQuotes({...raw,pricingBasis:undefined}));});
test('vol panel exposes fixed-weight forecast without claiming observed VRP',()=>{ctx.renderVol();assert(nodes.volGrid.innerHTML.includes('HAR-LIKE RV FORECAST'));assert(nodes.volDecisionNote.innerHTML.includes('not an edge claim'));assert(nodes.volDecisionNote.innerHTML.includes('Yang–Zhang cannot be computed'));});
test('new volatility and execution concepts are indexed and hover-documented',()=>{for(const term of ['HAR-LIKE RV FORECAST','INPUT IV − RV','INPUT IV / RV','EXECUTABLE-BID PRICING BASIS','YANG–ZHANG UNAVAILABLE']){assert(html.includes(`<div class="term-name">${term}</div>`),term+' guide entry');assert(ctx.HELP_TEXT[term],term+' hover help');}assert(ctx.HELP_TEXT['IMPORT HISTORICAL PREMIUMS FOR PROFIT COMPARISON']);});
test('selection risks can reject every quoted candidate',()=>{const {base,raw}=quoteFixture();for(const r of raw.rows){r.putPremium=0;r.callPremium=0;r.putCosts=10;}const q=ctx.quoteComparison(ctx.validateObjectiveQuotes(raw),base,.3,false);assert.equal(q.profit,null);});
test('explorer fixed winner is independent of later outcomes',()=>{const a=Array.from({length:100},(_,i)=>({entryTs:i*10,expiryTs:i*10+5,ret:i%2?1:-2,pathMinRet:-3,pathMaxRet:2})),x=ctx.explorerStudy(a,.3,5,.5,false),y=ctx.explorerStudy(a.map((v,i)=>i>=70?{...v,ret:99}:v),.3,5,.5,false);assert.equal(x.rows[0].pick.p,y.rows[0].pick.p);assert.equal(x.rows[0].pick.c,y.rows[0].pick.c);assert.notEqual(x.rows[0].hold.rate,y.rows[0].hold.rate);});
test('all panels render in four research modes with complete synthetic data',()=>{for(const mode of ['friday0dte','weekend','intraday','multi']){nodes.researchMode.value=mode;ctx.syncControls();ctx.run();assert(ctx.state.records.length>0);assert(nodes.researchState.textContent.includes('CURRENT'));assert(!nodes.caseBody.innerHTML.includes('undefined'));}});
test('empty regime sample renders without missing-value crashes',()=>{nodes.researchMode.value='friday0dte';nodes.regime.value='dd20';ctx.syncControls();ctx.run();assert.equal(ctx.state.records.length,0);});
test('scenario bootstrap preserves numeric returns and exact constant paths',()=>{
  const positive=ctx.scenarioBootstrap({returns:Array(8).fill(.02),compoundable:true},'block',4,100);near(positive.meanLo,.02);near(positive.meanHi,.02);near(positive.drawdown95,0);
  const negative=ctx.scenarioBootstrap({returns:Array(8).fill(-.1),compoundable:true},'iid',4,100);near(negative.meanLo,-.1);near(negative.meanHi,-.1);near(negative.drawdown95,1-Math.pow(.9,8));
});
test('scenario bootstrap is reproducible, mode-aware and does not mutate returns',()=>{
  const returns=Array.from({length:40},(_,i)=>i<20?-.08:.1),before=[...returns],p={returns,compoundable:true},a=ctx.scenarioBootstrap(p,'block',4,500),b=ctx.scenarioBootstrap(p,'block',4,500),iid=ctx.scenarioBootstrap(p,'iid',4,500);
  assert.deepEqual(a,b);assert.deepEqual(returns,before);assert(a.meanLo<.01&&a.meanHi>.01);assert(a.meanHi-a.meanLo>iid.meanHi-iid.meanLo);assert(a.drawdown95>=0&&a.drawdown95<=1);
});
test('bootstrap unavailable samples, overlap and capital exhaustion are guarded',()=>{
  for(const returns of [[],Array(7).fill(.1),[NaN,...Array(8).fill(.1)]])assert(Number.isNaN(ctx.scenarioBootstrap({returns,compoundable:true}).meanLo));
  const disabled=ctx.scenarioBootstrap({returns:Array(8).fill(-1),compoundable:false},'block',999,100);near(disabled.meanLo,-1);assert(Number.isNaN(disabled.drawdown95));assert.equal(disabled.blockLen,7);
});
test('nested overlapping trades disable sequential performance and resampled drawdown',()=>{
  ctx.state.range={lo:-2,hi:2};const s={strategy:'strangle',capitalMode:'csp',credit:1,wing:5},a=Array.from({length:8},(_,i)=>({entryTs:i*10,expiryTs:i===0?100:i*10+5,entry:100,expiry:100})),p=ctx.scenarioPerformance(a,s);
  assert.equal(p.overlaps,7);assert.equal(p.compoundable,false);assert(Number.isNaN(p.cagr));assert(Number.isNaN(ctx.scenarioBootstrap(p,'block',4,100).drawdown95));
  assert.equal(ctx.scenarioPerformance([{...a[0],expiryTs:0}],s).compoundable,false);
});
test('scenario bootstrap metrics have guide entries and hover explanations',()=>{
  for(const term of ['SCENARIO MEAN ROI 95% CI','RESAMPLED MAX DD · P95']){assert(html.includes(`<div class="term-name">${term}</div>`));assert(ctx.HELP_TEXT[term]);}
  nodes.researchMode.value='friday0dte';nodes.regime.value='all';ctx.syncControls();ctx.run();assert(nodes.performanceGrid.innerHTML.includes('SCENARIO MEAN ROI 95% CI'));assert(nodes.performanceNote.innerHTML.includes('not a future loss bound'));
});
test('payoff plot handles a missing historical entry anchor',()=>{
  const old=ctx.state.daily,live=ctx.state.live;ctx.state.daily=[];ctx.state.live={...live,entryPrice:NaN,price:100000,entryTs:NaN};ctx.renderPayoff({...ctx.settings(),mode:'friday0dte'});ctx.state.daily=old;ctx.state.live=live;
});
test('case analytics independently reconcile cumulative returns, attribution and recovery',()=>{
  ctx.state.range={lo:-2,hi:2};const s={strategy:'strangle',capitalMode:'csp',credit:19.6,wing:5},start=Date.UTC(2024,0,1);
  const trades=[.2,-.1,.2].map((r,i)=>({entryTs:start+i*DAY,expiryTs:start+i*DAY+HOUR,entry:100,expiry:98-(19.6-r*98)}));
  const p=ctx.casePerformanceStudy([...trades].reverse(),s);near(p.equity,1.296);near(p.additive,.3);near(p.option,.3);near(p.backing,0);near(p.winRate,2/3);near(p.maxDrawdown,.1);near(p.profitFactor,4);near(p.avgLoss,-.1);near(p.tailMean,-.1);assert.equal(p.episodes.length,1);assert.equal(p.episodes[0].recovery,trades[2].expiryTs);near(p.longest,2);assert.equal(p.calendar[0].months[0].length,3);near(p.points.at(-1).total,p.points.at(-1).option+p.points.at(-1).backing);
  const open=ctx.casePerformanceStudy(trades.slice(0,2),s);assert.equal(open.episodes[0].recovery,null);near(open.longest,1);
});
test('case analytics keep full sample, use expiry calendar, and guard path metrics',()=>{
  ctx.state.range={lo:-2,hi:2};const s={strategy:'strangle',capitalMode:'csp',credit:1,wing:5},start=Date.UTC(2023,0,1),trades=Array.from({length:450},(_,i)=>({entryTs:start+i*DAY,expiryTs:start+i*DAY+HOUR,entry:100,expiry:100}));
  const p=ctx.casePerformanceStudy(trades,s);assert.equal(p.n,450);assert.equal(p.points.length,451);near(p.points[20].rolling,1/98);assert(Number.isNaN(p.points[19].rolling));assert.equal(p.calendar.length,2);
  const crossed=ctx.casePerformanceStudy([{...trades[0],entryTs:Date.UTC(2023,0,31,23),expiryTs:Date.UTC(2023,1,1,1)}],s);assert.equal(crossed.calendar[0].months[1].length,1);
  const overlap=ctx.casePerformanceStudy([{...trades[0],expiryTs:start+2*DAY},trades[1]],s);assert(!overlap.compoundable);assert(Number.isNaN(overlap.points.at(-1).equity));assert(Number.isFinite(overlap.additive));assert.equal(overlap.episodes.length,0);
  const exhausted=ctx.casePerformanceStudy([{...trades[0],expiry:-100}],s);assert(!exhausted.compoundable);assert(Number.isNaN(exhausted.ulcer));
  for(const a of [[],[{...trades[0],entryTs:NaN}]]){const e=ctx.casePerformanceStudy(a,s);assert(!e.compoundable);assert.equal(e.points.length,0);}
});

test('cumulative return toggle switches interpretation and retains selected mode on rerender',()=>{
  ctx.state.range={lo:-2,hi:2};const s={strategy:'strangle',capitalMode:'csp',credit:19.6,wing:5},start=Date.UTC(2024,0,1),records=[.2,-.1].map((r,i)=>({entryTs:start+i*DAY,expiryTs:start+i*DAY+HOUR,entry:100,expiry:98-(19.6-r*98)})),p=ctx.casePerformanceStudy(records,s);
  near(p.points.at(-1).equity-1,.08);near(p.points.at(-1).total,.1);
  nodes.caseReturnMode.value='simple';ctx.renderCaseEquity(p);assert.equal(nodes.caseEquityTitle.textContent,'CUMULATIVE NON-COMPOUNDED RETURN');assert(nodes.caseEquityNote.textContent.includes('profits are not reinvested'));
  const previous=ctx.state.records;ctx.state.records=records;ctx.renderCasePerformance(s);assert.equal(nodes.caseReturnMode.value,'simple');assert.equal(nodes.caseEquityTitle.textContent,'CUMULATIVE NON-COMPOUNDED RETURN');ctx.state.records=previous;
  nodes.caseReturnMode.value='compound';ctx.renderCaseEquity(p);assert.equal(nodes.caseEquityTitle.textContent,'SEQUENTIAL COMPOUNDED RETURN');assert(nodes.caseEquityNote.textContent.includes('Product of'));
});
test('return mode links drawdown, calendar and exact reinvested attribution',()=>{
  ctx.state.range={lo:-2,hi:2};const s={strategy:'strangle',capitalMode:'csp',credit:19.6,wing:5},start=Date.UTC(2024,0,1),trades=[.2,-.1,.2].map((r,i)=>({entryTs:start+i*DAY,expiryTs:start+i*DAY+HOUR,entry:100,expiry:98-(19.6-r*98)}));
  const compound=ctx.casePerformanceStudy(trades,s,'compound'),simple=ctx.casePerformanceStudy(trades,s,'simple');near(compound.equity,1.296);near(simple.equity,1.3);near(compound.maxDrawdown,.1);near(simple.maxDrawdown,1-1.1/1.2);assert(Number.isNaN(simple.cagr));
  for(const p of [compound,simple])for(const x of p.points)near(x.equity-1,x.pathOption+x.pathBacking);
  const previous=ctx.state.records;ctx.state.records=trades;nodes.caseReturnMode.value='simple';ctx.renderCasePerformance(s);assert(nodes.caseDrawdownTitle.textContent.startsWith('NON-COMPOUNDED'));assert(nodes.caseCalendarBody.innerHTML.includes('30.0%'));nodes.caseReturnMode.value='compound';ctx.renderCasePerformance(s);assert(nodes.caseCalendarBody.innerHTML.includes('29.6%'));ctx.state.records=previous;
});
test('start-date filtering applies to intraday weekend and multi-day evaluation, preserving training',()=>{
  seed();const s={...ctx.settings(),lookback:'all',regime:'all'},cut=Date.UTC(2023,0,1),start='2023-01-01';
  for(const mode of ['friday0dte','weekend','multi']){const setup={...s,mode,evaluationStart:start};const full=ctx.makeBase({...setup,evaluationStart:''},true),filtered=ctx.makeBase(setup,true),training=ctx.makeBase(setup,false);assert(filtered.length>0);assert(filtered.length<full.length);assert(filtered.every(x=>x.entryTs>=cut));assert(training.some(x=>x.entryTs<cut));assert.equal(ctx.makeBase({...setup,evaluationStart:'2099-01-01'},true).length,0);}
  const previous=ctx.state.baseEval;ctx.state.baseEval=[];assert.equal(ctx.walkForward(s).length,0);ctx.state.baseEval=previous;
});
test('start-date control remains bounded by eligible sessions and curve rebases from zero',()=>{
  seed();const s={...ctx.settings(),lookback:'all',regime:'all',evaluationStart:'2023-01-01'};nodes.replayStart.value=s.evaluationStart;ctx.syncReplayControls(s);assert(nodes.replayStart.min< s.evaluationStart);assert(nodes.replayStart.max>=s.evaluationStart);assert(Number(nodes.replaySlider.max)>0);
  const records=ctx.makeBase(s,true);ctx.state.range={lo:-2,hi:2};const study=ctx.casePerformanceStudy(records,s,'simple');near(study.points[0].total,0);near(study.points[0].equity,1);assert.equal(study.points[0].ts,Date.parse(s.evaluationStart+'T00:00:00Z'));nodes.replayStart.value='';
});
function ivChain(asOf,expiryLabel,F,strikes,ivOf,bid=.01){const rows=[];for(const K of strikes)for(const t of ['C','P'])rows.push({instrument_name:`BTC-${expiryLabel}-${K}-${t}`,mark_iv:ivOf(K),underlying_price:F,bid_price:bid,open_interest:1});return rows;}
function indepDelta(F,K,T,sigma,type){const cdf=x=>{const s=x<0?-1:1,t=1/(1+.3275911*Math.abs(x)/Math.SQRT2),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x/2);return .5*(1+s*y);},d1=(Math.log(F/K)+.5*sigma*sigma*T)/(sigma*Math.sqrt(T));return type==='call'?cdf(d1):cdf(d1)-1;}
test('IV by delta parses Deribit instrument names and rejects malformed ones',()=>{
  const p=ctx.parseDeribitOption('BTC-13NOV26-83000-P');assert.equal(p.expiryTs,Date.UTC(2026,10,13,8));assert.equal(p.strike,83000);assert.equal(p.type,'put');
  const c=ctx.parseDeribitOption('BTC-5NOV26-80000-C');assert.equal(c.expiryTs,Date.UTC(2026,10,5,8));assert.equal(c.type,'call');
  for(const bad of ['ETH-13NOV26-83000-P','BTC-PERPETUAL','BTC-13XXX26-83000-C','BTC-13NOV26-83000-X','BTC-13NOV26-ABC-C',undefined,null])assert.equal(ctx.parseDeribitOption(bad),null);
});
test('IV by delta uses forward-based delta, nearest listed strike, and put-minus-call skew',()=>{
  const asOf=Date.UTC(2026,10,5,9),F=80000,strikes=Array.from({length:41},(_,i)=>60000+i*1000),T=(Date.UTC(2026,10,13,8)-asOf)/(365*DAY);
  const rows=ctx.ivDeltaChain(ivChain(asOf,'13NOV26',F,strikes,K=>K<F?55:K===F?50:45),asOf);assert.equal(rows.length,1);const r=rows[0];
  assert.equal(r.days,8);assert.equal(r.forward,F);
  const want=[['p20','put',-.20],['p35','put',-.35],['c35','call',.35],['c20','call',.20]];
  for(const [key,type,target] of want){const x=r.cells[key];assert(x,key);assert.equal(x.type,type);near(x.delta,indepDelta(F,x.strike,T,x.iv,type),1e-6);assert(Math.abs(x.delta-target)<.05,key+' within strike spacing');
    for(const K of strikes){const d=indepDelta(F,K,T,(K<F?55:K===F?50:45)/100,type);if(!(type==='put'?K<F:K>F))continue;assert(Math.abs(x.delta-target)<=Math.abs(d-target)+1e-6,key+' is nearest listed strike');}}
  assert(r.cells.p20.strike<F&&r.cells.c20.strike>F);assert(r.cells.p35.strike>r.cells.p20.strike&&r.cells.p35.strike<F);assert(r.cells.c35.strike<r.cells.c20.strike);
  assert.equal(r.cells.atm.strike,80000);near(r.cells.atm.iv,.5);assert(r.cells.atm.bid);near(r.skew,10,1e-9);
});
test('IV by delta skips expired, invalid and out-of-tolerance data',()=>{
  const asOf=Date.UTC(2026,10,5,9),F=80000,ok=ivChain(asOf,'13NOV26',F,[78000,80000,82000],()=>50);
  const bad=[...ivChain(asOf,'4NOV26',F,[80000],()=>50),{instrument_name:'BTC-13NOV26-79000-C',mark_iv:0,underlying_price:F},{instrument_name:'BTC-13NOV26-79000-P',mark_iv:null,underlying_price:F},{instrument_name:'BTC-13NOV26-79500-C',mark_iv:50,underlying_price:0},{instrument_name:'BTC-13NOV26-79500-P',mark_iv:NaN,underlying_price:F},null,{}];
  const rows=ctx.ivDeltaChain([...ok,...bad],asOf);assert.equal(rows.length,1);assert.equal(rows[0].expiryTs,Date.UTC(2026,10,13,8));assert.equal(rows[0].cells.atm.strike,80000);
  const far=ctx.ivDeltaChain(ivChain(asOf,'13NOV26',F,[60000],()=>50),asOf)[0];assert.equal(far.cells.p20,null);assert.equal(far.cells.c20,null);assert(Number.isNaN(far.skew));assert.equal(far.cells.atm.strike,60000);
  assert.equal(ctx.ivDeltaChain(null,asOf).length,0);assert.equal(ctx.ivDeltaChain([],asOf).length,0);
});
test('IV by delta renders a complete table, dims no-bid cells, and handles empty or failed states',()=>{
  const asOf=Date.UTC(2026,10,5,9),F=80000,strikes=Array.from({length:41},(_,i)=>60000+i*1000),chain=ivChain(asOf,'13NOV26',F,strikes,K=>K<F?55:K===F?50:45);
  for(const x of chain)if(/-6[0-9]000-P$/.test(x.instrument_name))x.bid_price=0;
  const st=ctx.state.ivDelta=ctx.state.ivDelta||{};Object.assign(st,{rows:ctx.ivDeltaChain(chain,asOf),asOf,count:chain.length,status:'LIVE',error:'',busy:false});ctx.renderIvDelta();
  const html=nodes.ivDeltaBody.innerHTML;assert(html.includes('Nov 13'));assert(html.includes('%'));assert(html.includes('+10.00'));assert(!html.includes('undefined'));assert(!html.includes('NaN'));assert(nodes.ivDeltaLabel.textContent.includes('LIVE'));assert(nodes.ivDeltaLabel.textContent.includes(String(chain.length)));assert(nodes.ivDeltaNote.innerHTML.includes('not an executable price'));
  Object.assign(st,{rows:ctx.ivDeltaChain(ivChain(asOf,'13NOV26',F,[60000],()=>50),asOf)});ctx.renderIvDelta();assert(nodes.ivDeltaBody.innerHTML.includes('—'));assert(!nodes.ivDeltaBody.innerHTML.includes('NaN'));
  Object.assign(st,{rows:[],status:'FAILED',error:'<b>HTTP 403</b>'});ctx.renderIvDelta();assert(nodes.ivDeltaBody.innerHTML.includes('Could not load'));assert(!nodes.ivDeltaBody.innerHTML.includes('<b>HTTP'));
  Object.assign(st,{rows:[],status:'NOT LOADED',error:''});ctx.renderIvDelta();assert(nodes.ivDeltaBody.innerHTML.includes('No option chain loaded'));
});
test('IV by delta panel exists with hover help and does not alter historical records',()=>{
  assert(html.includes('id="ivDeltaPanel"'));assert(html.includes('02C / IV BY DELTA'));assert(ctx.HELP_TEXT['IV BY DELTA']);
  seed();nodes.researchMode.value='friday0dte';nodes.regime.value='all';ctx.syncControls();ctx.run();const before=ctx.state.records.length;ctx.state.ivDelta.rows=[];ctx.renderIvDelta();ctx.run();assert.equal(ctx.state.records.length,before);
});
function liveChain(now,expLabel,F,strikes,bidBtc=.0005,index=80000){const rows=ivChain(now,expLabel,F,strikes,K=>K<F?55:K===F?50:45,bidBtc);for(const r of rows)r.estimated_delivery_price=index;return rows;}
function cdfStd(x){const s=x<0?-1:1,t=1/(1+.3275911*Math.abs(x)/Math.SQRT2),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x/2);return .5*(1+s*y);}
function setChain(now,rows){ctx.state.ivDelta={rows:ctx.ivDeltaChain(rows,now),asOf:now,count:rows.length,status:'LIVE',error:'',busy:false};}
function resetResearchControls(){nodes.researchMode.value='friday0dte';nodes.capitalMode.value='covered';nodes.strategy.value='strangle';nodes.rangeMethod.value='manual';nodes.lowerPct.value='-2';nodes.upperPct.value='2';nodes.creditPct.value='2';nodes.ivApplyDelta.value='20';}
function withLiveSession(now,fn){const orig=ctx.Date,live0=ctx.state.live;class Frozen extends Date{static now(){return now;}}ctx.Date=Frozen;ctx.state.live={...live0,price:80000,ts:now,entryPrice:NaN,entryTs:NaN};try{seed();resetResearchControls();ctx.syncControls();ctx.run();fn();}finally{ctx.Date=orig;ctx.state.live=live0;resetResearchControls();ctx.state.ivApplied=null;}}
test('IV by delta cells carry USD bid and risk-neutral exceedance probability',()=>{
  const asOf=Date.UTC(2026,10,5,9),F=80000,T=(Date.UTC(2026,10,13,8)-asOf)/(365*DAY),rows=liveChain(asOf,'13NOV26',F,[78000,80000,82000],.001,79000);
  const r=ctx.ivDeltaChain(rows,asOf)[0],put=r.cells.atm;assert(put);
  const chain=ctx.ivDeltaChain(rows,asOf)[0],opts=[['put',78000],['call',82000]];
  for(const [type,K] of opts){const c=[chain.cells.p20,chain.cells.p35,chain.cells.c35,chain.cells.c20].find(x=>x&&x.type===type&&x.strike===K);assert(c,type+K);near(c.bidUsd,.001*79000,1e-9);const iv=c.iv,d2=(Math.log(F/K)-.5*iv*iv*T)/(iv*Math.sqrt(T));near(c.itm,type==='put'?cdfStd(-d2):cdfStd(d2),1e-6);}
  const noIdx=liveChain(asOf,'13NOV26',F,Array.from({length:41},(_,i)=>70000+i*500),.001);for(const x of noIdx)delete x.estimated_delivery_price;const c2=ctx.ivDeltaChain(noIdx,asOf)[0].cells.p20;assert(c2);near(c2.bidUsd,.001*F,1e-9);
  const noBid=ctx.ivDeltaChain(liveChain(asOf,'13NOV26',F,[80000],0),asOf)[0].cells.atm;assert.equal(noBid.bid,false);
});
test('live strikes plan matches the session expiry, anchors to spot, prices credit from bids and compares implied vs realized',()=>{
  const now=Date.UTC(2026,10,5,9,15),F=80050,strikes=Array.from({length:49},(_,i)=>74000+i*250);
  withLiveSession(now,()=>{
    setChain(now,liveChain(now,'6NOV26',F,strikes));
    const s=ctx.settings(),p=ctx.ivLivePlan(s),T=(Date.UTC(2026,10,6,8)-now)/(365*DAY);
    assert(p.valid,p.reason);assert.equal(p.expiryTs,Date.UTC(2026,10,6,8));assert.equal(p.anchor,80000);assert.equal(p.target,20);
    assert(p.put.strike<80000&&p.call.strike>80000);near(p.lo,(p.put.strike/80000-1)*100,1e-9);near(p.hi,(p.call.strike/80000-1)*100,1e-9);
    assert(Math.abs(p.put.delta+.2)<.05&&Math.abs(p.call.delta-.2)<.05);
    near(p.creditUsd,.0005*80000*2,1e-9);near(p.credit,.1,1e-9);
    const d2=(K,iv)=>(Math.log(F/K)-.5*iv*iv*T)/(iv*Math.sqrt(T));
    near(p.implied,1-cdfStd(-d2(p.put.strike,p.put.iv))-cdfStd(d2(p.call.strike,p.call.iv)),1e-6);
    const base=ctx.state.baseEval;assert(base.length>0);assert.equal(p.n,base.length);near(p.hist,base.filter(x=>x.ret>=p.lo&&x.ret<=p.hi).length/base.length,1e-12);
    nodes.ivApplyDelta.value='35';const p35=ctx.ivLivePlan(ctx.settings());assert.equal(p35.target,35);assert(Math.abs(p35.put.delta+.35)<.05&&Math.abs(p35.call.delta-.35)<.05);assert(p35.put.strike>p.put.strike&&p35.call.strike<p.call.strike);nodes.ivApplyDelta.value='20';
    ctx.applyLiveStrikes();
    assert.equal(nodes.strategy.value,'strangle');assert.equal(nodes.rangeMethod.value,'manual');assert.equal(nodes.lowerPct.value,p.lo.toFixed(6));assert.equal(nodes.upperPct.value,p.hi.toFixed(6));assert.equal(nodes.creditPct.value,'0.1000');
    assert(Math.abs(ctx.state.range.lo-p.lo)<1e-5&&Math.abs(ctx.state.range.hi-p.hi)<1e-5);assert(ctx.state.records.length>0&&ctx.state.records.every(x=>x.lo===ctx.state.range.lo&&x.hi===ctx.state.range.hi));
    assert(ctx.ivAppliedActive(ctx.settings()));assert(nodes.caseLabel.textContent.includes('LIVE 20Δ STRIKES'));assert(nodes.caseLabel.textContent.includes('NOV 6'));assert(nodes.ivApplyGrid.innerHTML.includes('>APPLIED<'));assert(nodes.ivApplyGrid.innerHTML.includes('HISTORICAL INSIDE'));assert.equal(nodes.applyLiveStrikes.disabled,false);
    nodes.lowerPct.value='-5';ctx.run();assert(!ctx.ivAppliedActive(ctx.settings()));assert(!nodes.caseLabel.textContent.includes('LIVE'));assert(nodes.ivApplyGrid.innerHTML.includes('>NOT APPLIED<'));
    ctx.applyLiveStrikes();assert(ctx.ivAppliedActive(ctx.settings()));nodes.strategy.value='straddle';ctx.syncControls();ctx.run();assert(!ctx.ivAppliedActive(ctx.settings()));
  });
});
test('live strikes guard unmatched expiry, stale snapshot, sparse strikes, wrong preset and missing bids',()=>{
  const now=Date.UTC(2026,10,5,9,15),F=80050,strikes=Array.from({length:49},(_,i)=>74000+i*250);
  withLiveSession(now,()=>{
    setChain(now,liveChain(now,'7NOV26',F,strikes));let p=ctx.ivLivePlan(ctx.settings());assert(!p.valid&&p.reason.includes('lists no expiry'));
    ctx.renderIvApply(ctx.settings());assert.equal(nodes.applyLiveStrikes.disabled,true);assert.equal(nodes.ivApplyGrid.innerHTML,'');
    setChain(now,liveChain(now,'6NOV26',F,strikes));ctx.state.ivDelta.asOf=now-11*60000;p=ctx.ivLivePlan(ctx.settings());assert(!p.valid&&p.reason.includes('older than 10 minutes'));
    setChain(now,liveChain(now,'6NOV26',F,[60000]));p=ctx.ivLivePlan(ctx.settings());assert(!p.valid&&p.reason.includes('No listed strike'));
    ctx.state.ivDelta={rows:[],asOf:NaN,count:0,status:'NOT LOADED',error:'',busy:false};p=ctx.ivLivePlan(ctx.settings());assert(!p.valid&&p.reason.includes('No option chain'));
    setChain(now,liveChain(now,'6NOV26',F,strikes));nodes.researchMode.value='multi';ctx.syncControls();p=ctx.ivLivePlan(ctx.settings());assert(!p.valid&&p.reason.includes('no single session expiry'));nodes.researchMode.value='friday0dte';ctx.syncControls();
    setChain(now,liveChain(now,'6NOV26',F,strikes,0));p=ctx.ivLivePlan(ctx.settings());assert(p.valid);assert(Number.isNaN(p.creditUsd));ctx.renderIvApply(ctx.settings());assert(nodes.ivApplyGrid.innerHTML.includes('NO BID'));ctx.applyLiveStrikes();assert.equal(nodes.creditPct.value,'2');assert(ctx.ivAppliedActive(ctx.settings()));
    resetResearchControls();ctx.syncControls();nodes.capitalMode.value='csp';ctx.syncControls();setChain(now,liveChain(now,'6NOV26',F,strikes));nodes.upperPct.value='3';p=ctx.ivLivePlan(ctx.settings());
    assert(p.valid&&p.csp&&p.call===null&&Number.isNaN(p.hi));near(p.credit,.05,1e-9);near(p.implied,1-p.put.itm,1e-12);const base=ctx.state.baseEval;near(p.hist,base.filter(x=>x.ret>=p.lo).length/base.length,1e-12);
    ctx.applyLiveStrikes();assert.equal(nodes.upperPct.value,'3');assert.equal(nodes.lowerPct.value,p.lo.toFixed(6));assert(nodes.ivApplyGrid.innerHTML.includes('NOT WRITTEN'));assert(nodes.ivApplyGrid.innerHTML.includes('IMPLIED ABOVE PUT'));
  });
  withLiveSession(Date.UTC(2026,10,6,9),()=>{ctx.state.ivDelta={rows:[{expiryTs:Date.UTC(2026,10,6,8),cells:{}}],asOf:Date.UTC(2026,10,6,9),count:1,status:'LIVE',error:'',busy:false};const p=ctx.ivLivePlan(ctx.settings());assert(!p.valid&&p.reason.includes('already expired'));});
});
test('live strikes use the session entry price as anchor once the session is active',()=>{
  const now=Date.UTC(2026,10,6,3),F=80050,strikes=Array.from({length:49},(_,i)=>74000+i*250);
  withLiveSession(now,()=>{
    ctx.state.live.entryPrice=80300;ctx.state.live.entryTs=Date.UTC(2026,10,6,0);setChain(now,liveChain(now,'6NOV26',F,strikes));
    const p=ctx.ivLivePlan(ctx.settings());assert(p.valid,p.reason);assert.equal(p.anchor,80300);near(p.lo,(p.put.strike/80300-1)*100,1e-9);near(p.hi,(p.call.strike/80300-1)*100,1e-9);near(p.credit,80/80300*100,1e-9);
    ctx.state.live.entryPrice=79000;const bad=ctx.ivLivePlan(ctx.settings());assert(!bad.valid&&bad.reason.includes('expected sides'));
  });
});
const CARRY_NOW=Date.UTC(2026,10,5,9,48),H8=8*3600e3;
const BYBIT=[['06NOV26',Date.UTC(2026,10,6),80384.9,80373.5,80419.5],['13NOV26',Date.UTC(2026,10,13),80574.4,80420.4,80688.6],['20NOV26',Date.UTC(2026,10,20),80655.8,80486.4,80772.5],['24SEP27',Date.UTC(2027,8,24),84342.7,84308.5,84376.9],['25DEC26',Date.UTC(2026,11,25),81049.99,80930.5,81142.8],['25JUN27',Date.UTC(2027,5,25),83220.1,83149.6,83275.1],['26MAR27',Date.UTC(2027,2,26),82158.7,82042.6,82257.2],['27NOV26',Date.UTC(2026,10,27),80748.3,80599.2,80870.6]];
const bybitTickers=()=>BYBIT.map(([n,,m,b,a])=>({symbol:'BTCUSDT-'+n,markPrice:String(m),indexPrice:n==='25DEC26'?'80348.35':'80348.4',bid1Price:String(b),ask1Price:String(a),lastPrice:'1'})).concat([{symbol:'BTCUSDT',markPrice:'80343.3',indexPrice:'80348.33',fundingRate:'0.0001',nextFundingTime:'1793894400000'}]);
const bybitInstruments=()=>BYBIT.map(([n,d])=>({symbol:'BTCUSDT-'+n,deliveryTime:String(d+H8),fundingInterval:0})).concat([{symbol:'BTCUSDT',deliveryTime:'0',fundingInterval:480}]);
test('carry curve: basis, annualized carry at mark and bid, ordering and best contract from a real Bybit snapshot',()=>{
  const c=ctx.carryCurve(bybitTickers(),bybitInstruments(),CARRY_NOW);
  assert.deepEqual([...c.rows.map(r=>r.symbol)],['06NOV26','13NOV26','20NOV26','27NOV26','25DEC26','26MAR27','25JUN27','24SEP27'].map(x=>'BTCUSDT-'+x));
  for(const r of c.rows){const [,d,m,b,a]=BYBIT.find(x=>'BTCUSDT-'+x[0]===r.symbol),idx=r.symbol.endsWith('25DEC26')?80348.35:80348.4,days=(d+H8-CARRY_NOW)/DAY;
    near(r.days,days,1e-9);near(r.basis,(m-idx)/idx*100,1e-9);near(r.ann,(m-idx)/idx*100*365/days,1e-9);near(r.bidAnn,(b-idx)/idx*100*365/days,1e-9);near(r.spread,(a-b)/m*100,1e-9);assert.equal(r.noisy,days<2);}
  assert.equal(c.rows.filter(r=>r.noisy).length,1);assert.equal(c.rows[0].symbol,'BTCUSDT-06NOV26');
  const r13=c.rows[1];assert(Math.abs(r13.ann-12.97)<.05,'13NOV26 mark carry ~13%');assert(Math.abs(r13.bidAnn-4.1)<.1,'13NOV26 bid carry ~4%');
  assert.equal(c.bestMark.symbol,'BTCUSDT-13NOV26');assert.equal(c.best.symbol,'BTCUSDT-24SEP27');near(c.best.bidAnn,5.57,.02);
  assert(c.rows.slice(1).every(r=>r.bidAnn<=c.best.bidAnn));
});
test('carry curve skips bad rows and tolerates malformed input',()=>{
  const ok=bybitTickers().find(t=>t.symbol==='BTCUSDT-13NOV26'),inst=bybitInstruments(),bad=[{...ok,symbol:'BTCUSDT-13NOV26',indexPrice:'0'},{...ok,symbol:'BTCUSDT-20NOV26',markPrice:'0'},{...ok,symbol:'BTCUSDT-27NOV26'},{...ok,symbol:'BTC-PERPETUAL'},{...ok,symbol:'BTCUSDT'},null,{}];
  const wrongDelivery=inst.filter(i=>i.symbol!=='BTCUSDT-27NOV26').map(i=>i.symbol==='BTCUSDT-13NOV26'?{...i,deliveryTime:String(CARRY_NOW-1)}:i);
  assert.equal(ctx.carryCurve(bad,wrongDelivery,CARRY_NOW).rows.length,0);
  const one=ctx.carryCurve([{...ok,bid1Price:'',ask1Price:'80000'}],inst,CARRY_NOW);assert.equal(one.rows.length,1);assert(Number.isNaN(one.rows[0].bidAnn));assert(Number.isNaN(one.rows[0].spread));assert.equal(one.best,null);near(one.bestMark.ann,one.rows[0].ann);
  const cross=ctx.carryCurve([{...ok,bid1Price:'80700',ask1Price:'80600'}],inst,CARRY_NOW).rows[0];assert(Number.isNaN(cross.spread));
  for(const x of [null,undefined,'x',{}])assert.equal(ctx.carryCurve(x,x,CARRY_NOW).rows.length,0);
  const onlyNoisy=ctx.carryCurve(bybitTickers().filter(t=>t.symbol==='BTCUSDT-06NOV26'),inst,CARRY_NOW);assert.equal(onlyNoisy.rows.length,1);assert.equal(onlyNoisy.best,null);assert.equal(onlyNoisy.bestMark,null);
});
test('carry funding annualizes by the perpetual interval and ignores missing readings',()=>{
  const perp={fundingRate:'0.0001',nextFundingTime:'1793894400000'},hist=Array.from({length:21},(_,i)=>({fundingRate:i%2?'0.0002':'0'}));
  let f=ctx.carryFunding(perp,hist,480);near(f.ann,.0001*3*365*100,1e-9);near(f.ann,10.95,1e-9);assert.equal(f.intervalMin,480);assert.equal(f.assumedInterval,false);assert.equal(f.n,21);near(f.avgAnn,(10*.0002/21)*3*365*100,1e-9);assert.equal(f.nextTs,1793894400000);
  f=ctx.carryFunding(perp,hist,240);near(f.ann,.0001*6*365*100,1e-9);
  f=ctx.carryFunding(perp,[],NaN);assert.equal(f.assumedInterval,true);assert.equal(f.intervalMin,480);assert.equal(f.n,0);assert(Number.isNaN(f.avgAnn));near(f.ann,10.95,1e-9);
  f=ctx.carryFunding(null,[null,{},{fundingRate:null},{fundingRate:''},{fundingRate:'abc'},{fundingRate:'-0.0001'}],480);assert(Number.isNaN(f.ann));assert.equal(f.n,1);near(f.avgAnn,-10.95,1e-9);
  assert(Number.isNaN(ctx.carryFunding({fundingRate:null},undefined,480).ann));
});
test('carry vol context compares Deribit ATM IV nearest 7 days with the HAR-like forecast',()=>{
  seed();nodes.researchMode.value='friday0dte';ctx.syncControls();ctx.run();
  const har=ctx.carryVol().har;assert(Number.isFinite(har));near(har,.30*ctx.recentRV(5)+.40*ctx.recentRV(20)+.30*ctx.recentRV(60),1e-9);
  const ivRows=iv=>({rows:[{expiryTs:Date.UTC(2026,10,6,8),days:1,cells:{atm:{iv:.09}}},{expiryTs:Date.UTC(2026,10,12,8),days:7,cells:{atm:{iv}}},{expiryTs:Date.UTC(2026,11,25,8),days:50,cells:{atm:{iv:.9}}},{expiryTs:Date.UTC(2026,10,13,8),days:8,cells:{}}],asOf:CARRY_NOW,count:1,status:'LIVE',error:'',busy:false});
  const curve=ctx.carryCurve(bybitTickers(),bybitInstruments(),CARRY_NOW),perp=bybitTickers().find(t=>t.symbol==='BTCUSDT');
  ctx.state.carry={rows:curve.rows,best:curve.best,bestMark:curve.bestMark,funding:ctx.carryFunding(perp,[{fundingRate:'0.0001'}],480),asOf:CARRY_NOW,count:9,status:'LIVE',error:'',busy:false};
  for(const [mult,word] of [[1.2,'Vol selling paid'],[.8,'Vol selling underpaid'],[1,'Vol selling roughly fair']]){
    ctx.state.ivDelta=ivRows(har*mult/100);const v=ctx.carryVol();near(v.iv,har*mult,1e-9);near(v.ratio,mult,1e-9);assert(v.src.includes('Nov 12'),v.src);
    ctx.renderCarry();assert(nodes.carryVerdict.textContent.includes(word+' vs forecast RV'),nodes.carryVerdict.textContent);assert(nodes.carryLines.innerHTML.includes(word+': IV/forecast-RV '+mult.toFixed(2)+'×'));}
  ctx.state.ivDelta={rows:[],asOf:NaN,count:0,status:'NOT LOADED',error:'',busy:false};const manual=ctx.carryVol();assert.equal(manual.src,'manual IV input');near(manual.iv,ctx.settings().iv*100,1e-9);ctx.renderCarry();assert(nodes.carryVerdict.textContent.includes('× on manual IV)'),nodes.carryVerdict.textContent);ctx.state.ivDelta=ivRows(har/100);ctx.renderCarry();assert(!nodes.carryVerdict.textContent.includes('manual IV'));ctx.state.ivDelta={rows:[],asOf:NaN,count:0,status:'NOT LOADED',error:'',busy:false};
  const daily=ctx.state.daily;ctx.state.daily=[];try{const none=ctx.carryVol();assert(Number.isNaN(none.har));assert(Number.isNaN(none.ratio));ctx.renderCarry();assert(nodes.carryLines.innerHTML.includes('Vol comparison unavailable'));assert(!nodes.carryVerdict.textContent.includes('Vol selling'));assert(!nodes.carryLines.innerHTML.includes('NaN'));}finally{ctx.state.daily=daily;}
});
test('carry panel renders the curve, best star, funding line and failure states',()=>{
  const curve=ctx.carryCurve(bybitTickers(),bybitInstruments(),CARRY_NOW),perp=bybitTickers().find(t=>t.symbol==='BTCUSDT');
  ctx.state.ivDelta={rows:[],asOf:NaN,count:0,status:'NOT LOADED',error:'',busy:false};
  ctx.state.carry={rows:curve.rows,best:curve.best,bestMark:curve.bestMark,funding:ctx.carryFunding(perp,Array.from({length:21},()=>({fundingRate:'0.0001'})),480),asOf:CARRY_NOW,count:9,status:'LIVE',error:'',busy:false};ctx.renderCarry();
  const body=nodes.carryBody.innerHTML,label=nodes.carryLabel.textContent;
  assert(label.includes('LIVE')&&label.includes('8 CONTRACTS')&&label.includes('CONTANGO')&&label.includes('09:48:00 UTC'),label);
  assert.equal((body.match(/<tr/g)||[]).length,8);assert.equal((body.match(/★ best/g)||[]).length,1);assert(body.indexOf('BTCUSDT-24SEP27 <span')>0);assert(body.includes('2026-11-13 (8d)'));assert(body.includes('opacity:.6'));assert(body.includes('+0.28%'));assert(!body.includes('NaN')&&!body.includes('undefined'));
  assert(nodes.carryVerdict.textContent.includes('Best executable carry +5.6%/yr (BTCUSDT-24SEP27, 323d)'),nodes.carryVerdict.textContent);
  const lines=nodes.carryLines.innerHTML;assert(lines.includes('+13.0%/yr at mark (BTCUSDT-13NOV26)'));assert(lines.includes('selling at the bid (BTCUSDT-24SEP27)'));assert(lines.includes('Perp funding +10.9%/yr now (0.0100% per 8h)'),lines);assert(lines.includes('average over the last 21 periods'));assert(!lines.includes('NaN')&&!lines.includes('undefined'));
  const back=curve.rows.map(r=>({...r,basis:-1}));ctx.state.carry.rows=back;ctx.renderCarry();assert(nodes.carryLabel.textContent.includes('BACKWARDATION'));ctx.state.carry.rows=curve.rows.map((r,i)=>({...r,basis:i?1:-1}));ctx.renderCarry();assert(nodes.carryLabel.textContent.includes('MIXED CURVE'));
  ctx.state.carry={rows:[],best:null,funding:null,asOf:NaN,count:0,status:'FAILED',error:'<b>HTTP 403</b>',busy:false};ctx.renderCarry();assert(nodes.carryBody.innerHTML.includes('Could not load the Bybit futures curve'));assert(!nodes.carryBody.innerHTML.includes('<b>HTTP'));assert.equal(nodes.carryVerdict.textContent,'');assert.equal(nodes.carryLines.innerHTML,'');
  for(const [status,text] of [['NOT LOADED','No futures curve loaded'],['LOADING','Loading Bybit futures curve'],['EMPTY','no usable dated BTCUSDT futures']]){ctx.state.carry.status=status;ctx.renderCarry();assert(nodes.carryBody.innerHTML.includes(text),status);}
  const none=ctx.carryCurve(bybitTickers().filter(t=>t.symbol==='BTCUSDT-06NOV26'),bybitInstruments(),CARRY_NOW);ctx.state.carry={rows:none.rows,best:none.best,bestMark:none.bestMark,funding:null,asOf:CARRY_NOW,count:1,status:'LIVE',error:'',busy:false};ctx.renderCarry();assert(nodes.carryVerdict.textContent.includes('No executable carry quote'));assert(!nodes.carryBody.innerHTML.includes('★'));assert(!nodes.carryLines.innerHTML.includes('Perp funding'));
});
test('carry panel exists with hover help and never alters historical records',()=>{
  assert(html.includes('id="carryPanel"'));assert(html.includes('02D / CARRY MONITOR'));assert(ctx.HELP_TEXT['CARRY MONITOR']);
  seed();nodes.researchMode.value='friday0dte';nodes.regime.value='all';ctx.syncControls();ctx.run();const before=JSON.stringify(ctx.state.records.map(r=>[r.lo,r.hi,r.inside]));ctx.state.carry={rows:[],best:null,funding:null,asOf:NaN,count:0,status:'NOT LOADED',error:'',busy:false};ctx.renderCarry();ctx.run();assert.equal(JSON.stringify(ctx.state.records.map(r=>[r.lo,r.hi,r.inside])),before);
});
(async()=>{
  await new Promise(r=>setImmediate(r));
  const origFetch=ctx.fetch,realNow=Date.now(),urls=[],mode={hist:'ok',code:0,http:200};
  const dated=(n,days,mark,bid,ask)=>({t:{symbol:'BTCUSDT-'+n,markPrice:String(mark),indexPrice:'80000',bid1Price:String(bid),ask1Price:String(ask)},i:{symbol:'BTCUSDT-'+n,deliveryTime:String(Math.round(realNow+days*DAY)),fundingInterval:0}}),a=dated('10DEC26',10,80100,80050,80150),b=dated('20JAN27',40,80500,80450,80550);
  ctx.fetch=async url=>{urls.push(url);if(mode.http!==200)return{ok:false,status:mode.http,json:async()=>({})};if(url.includes('funding/history')&&mode.hist==='fail')throw Error('history down');
    const list=url.includes('tickers')?[a.t,b.t,{symbol:'BTCUSDT',markPrice:'80000',indexPrice:'80000',fundingRate:'0.0001',nextFundingTime:String(realNow+3600e3)}]:url.includes('instruments-info')?[a.i,b.i,{symbol:'BTCUSDT',deliveryTime:'0',fundingInterval:480}]:Array.from({length:21},()=>({fundingRate:'0.0001'}));
    return{ok:true,status:200,json:async()=>({retCode:mode.code,result:{list}})};};
  try{
    ctx.state.carry=undefined;await ctx.loadCarry();let st=ctx.state.carry;
    assert.equal(st.status,'LIVE');assert.equal(st.rows.length,2);assert.equal(st.busy,false);assert.equal(st.funding.intervalMin,480);assert.equal(st.funding.assumedInterval,false);near(st.funding.ann,10.95,1e-9);assert.equal(st.funding.n,21);assert(urls.length===3&&urls.every(u=>u.startsWith('https://api.bybit.com/v5/market/')));
    near(st.rows[0].basis,.125,1e-9);assert.equal(st.best.symbol,'BTCUSDT-20JAN27');assert(nodes.carryLabel.textContent.includes('LIVE'));assert(nodes.carryLabel.textContent.includes('2 CONTRACTS'));
    mode.hist='fail';await ctx.loadCarry();st=ctx.state.carry;assert.equal(st.status,'LIVE');assert.equal(st.funding.n,0);assert(Number.isNaN(st.funding.avgAnn));near(st.funding.ann,10.95,1e-9);
    mode.hist='ok';mode.code=10001;await ctx.loadCarry();st=ctx.state.carry;assert.equal(st.status,'FAILED');assert(st.error.includes('unexpected response'));assert.equal(st.busy,false);assert.equal(st.rows.length,2);assert(nodes.carryLabel.textContent.includes('FAILED'));
    mode.code=0;mode.http=403;await ctx.loadCarry();st=ctx.state.carry;assert.equal(st.status,'FAILED');assert(st.error.includes('HTTP 403'));
    ctx.fetch=origFetch;await ctx.loadCarry();st=ctx.state.carry;assert.equal(st.status,'FAILED');assert(st.error.includes('offline test'));assert.equal(st.busy,false);
    count++;console.log('PASS carry monitor loads from Bybit, survives a funding-history failure and reports errors without throwing');
  }catch(e){console.error(e);process.exitCode=1;}finally{ctx.fetch=origFetch;}
})();
(async()=>{ctx.state.ivDelta.busy=false;await ctx.loadIvDelta();assert.equal(ctx.state.ivDelta.status,'FAILED');assert(ctx.state.ivDelta.error.includes('offline test'));assert.equal(ctx.state.ivDelta.busy,false);count++;console.log('PASS IV by delta load failure is reported without throwing');})();
console.log(`${count} regression groups passed`);
module.exports={ctx,nodes,seed};

