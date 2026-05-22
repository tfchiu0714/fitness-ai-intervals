// ============================================================
// supabase.js - Cloud data layer (replaces localStorage)
// ============================================================
var SB_URL="https://lmdznxrhftnpeuiytmie.supabase.co";
var SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZHpueHJoZnRucGV1aXl0bWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2OTg2OTAsImV4cCI6MjA5MzI3NDY5MH0.BROVEMlm5ccuqusw7RvwYPBeqT20KWr2eP09ow5b7K8";
var sb=null;
var SB_USER=null;
var SB_READY=false;
var SB_LOADING=false;

// Cache layer - data loaded once at login, written back on change
var _cache={races:null,aiPlan:null,aiCoach:null,apiKey:null,apiUrl:null,apiModel:null,intervalsApiKey:null,intervalsAthleteId:null,intervalsAthleteName:null,routines:null};

function sbInit(){
  if(typeof supabase!=="undefined"){sb=supabase.createClient(SB_URL,SB_KEY);return true}
  return false
}

// ----- Auth -----
function sbSignUp(email,password,name){
  if(!sb)return;
  SB_LOADING=true;
  sb.auth.signUp({email:email,password:password,options:{data:{name:name}}}).then(function(r){
    SB_LOADING=false;
    if(r.error){alert("Signup failed: "+r.error.message);return}
    if(r.data.user){
      SB_USER=r.data.user;
      document.getElementById("auth-name").textContent=SB_USER.user_metadata.name||email;
      sbLoadAll().then(function(){showApp()})
    }else{
      alert("Check your email for the confirmation link, then log in.")
    }
  })
}

function sbSignIn(email,password){
  if(!sb)return;
  SB_LOADING=true;
  sb.auth.signInWithPassword({email:email,password:password}).then(function(r){
    SB_LOADING=false;
    if(r.error){alert("Login failed: "+r.error.message);return}
    SB_USER=r.data.user;
    document.getElementById("auth-name").textContent=SB_USER.user_metadata.name||email;
    sbLoadAll().then(function(){showApp()})
  })
}

function sbSignOut(){
  sb.auth.signOut().then(function(){
    SB_USER=null;SB_READY=false;
    _cache={races:null,aiPlan:null,aiCoach:null,apiKey:null,apiUrl:null,apiModel:null,intervalsApiKey:null,intervalsAthleteId:null,routines:null};
    showAuth()
  })
}

// ----- Data Loaders (called once after login) -----
async function sbLoadAll(){
  try{await sbLoadRaces()}catch(e){}
  try{await sbLoadAIPlan()}catch(e){}
  try{await sbLoadAICoach()}catch(e){}
  try{await sbLoadAPISettings()}catch(e){}
  try{await sbLoadIntervalsSettings()}catch(e){}
  try{await sbLoadIntervalsActivities()}catch(e){}
  try{await sbLoadRoutines()}catch(e){}
  SB_READY=true;
  if(sbIntervalsConnected()){setTimeout(function(){sbSyncIntervals().then(function(n){if(n>0)location.reload()}).catch(function(){})},800)}
}

async function sbLoadRaces(){
  var r=await sb.from("races").select("name,date,type,dist,target_time").eq("user_id",SB_USER.id).order("date");
  _cache.races=r.data||[]
}
async function sbLoadAIPlan(){
  var r=await sb.from("ai_plans").select("plan_data,commentary,atp").eq("user_id",SB_USER.id).maybeSingle();
  if(r.data){_cache.aiPlan=r.data.plan_data;_cache.aiCommentary=r.data.commentary||"";if(r.data.atp)_cache.atp=r.data.atp}
}
async function sbLoadAICoach(){
  var r=await sb.from("ai_coach").select("commentary").eq("user_id",SB_USER.id).maybeSingle();
  if(r.data){_cache.aiCoach=r.data.commentary||""}
}
async function sbLoadAPISettings(){
  var r=await sb.from("api_settings").select("api_key,api_url,api_model").eq("user_id",SB_USER.id).maybeSingle();
  if(r.data){_cache.apiKey=r.data.api_key;_cache.apiUrl=r.data.api_url;_cache.apiModel=r.data.api_model}
}

// ----- Drop-in replacements for localStorage functions -----

// getRD replacement
function sbGetRD(){
  if(!SB_READY)return _cache.races||[{name:"OD Triathlon",date:"2026-05-03",type:"B",dist:"1.5k/40k/10k"},{name:"Hyrox HK Doubles",date:"2026-05-10",type:"B",dist:"8 sta x2"},{name:"Sunshine Coast 70.3",date:"2026-09-13",type:"A",dist:"1.9+90+21.1km"}];
  return _cache.races.length>=2?_cache.races:[{name:"OD Triathlon",date:"2026-05-03",type:"B",dist:"1.5k/40k/10k"},{name:"Hyrox HK Doubles",date:"2026-05-10",type:"B",dist:"8 sta x2"},{name:"Sunshine Coast 70.3",date:"2026-09-13",type:"A",dist:"1.9+90+21.1km"}];
}

// sRD replacement - save races to cloud
async function sbSaveRaces(data){
  _cache.races=data;
  if(!SB_READY||!SB_USER)return;
  try{
    await sb.from("races").delete().eq("user_id",SB_USER.id);
    if(data.length>0){
      var rows=data.map(function(r,i){return{user_id:SB_USER.id,name:r.name,date:r.date,type:r.type,dist:r.dist,target_time:r.target_time||"",sort_order:i}});
      await sb.from("races").insert(rows)
    }
  }catch(e){}
}

// Save AI plan
async function sbSaveAIPlan(planData,commentary,atp){
  _cache.aiPlan=planData;_cache.aiCommentary=commentary;if(atp)_cache.atp=atp;
  if(!SB_READY||!SB_USER)return;
  try{await sb.from("ai_plans").upsert({user_id:SB_USER.id,plan_data:planData,commentary:commentary,atp:atp||null,saved_at:new Date().toISOString()},{onConflict:"user_id"})}catch(e){}
}

// Save AI coach
async function sbSaveAICoach(commentary){
  _cache.aiCoach=commentary;
  if(!SB_READY||!SB_USER)return;
  try{await sb.from("ai_coach").upsert({user_id:SB_USER.id,commentary:commentary,saved_at:new Date().toISOString()},{onConflict:"user_id"})}catch(e){}
}

// Save API settings
async function sbSaveAPISettings(key,url,model){
  _cache.apiKey=key;_cache.apiUrl=url;_cache.apiModel=model;
  if(!SB_READY||!SB_USER)return;
  try{await sb.from("api_settings").upsert({user_id:SB_USER.id,api_key:key,api_url:url,api_model:model,saved_at:new Date().toISOString()},{onConflict:"user_id"})}catch(e){}
}

// ----- Cache getters (used by app.js synchronously after load) -----
function sbGetAPIKey(){return _cache.apiKey||"sk-49826138731143ad850eb17b762ba044"}
function sbGetAPIUrl(){var u=_cache.apiUrl||"https://api.deepseek.com/chat/completions";if(u.indexOf("api.deepseek.com/v1")>=0)u="https://api.deepseek.com/chat/completions";return u}
function sbGetAPIModel(){return _cache.apiModel||"deepseek-chat"}
function sbGetAIPlan(){return _cache.aiPlan}
function sbGetAICommentary(){return _cache.aiCommentary||""}
function sbGetAICoach(){return _cache.aiCoach||""}

// ----- Auth UI helpers -----
var SB_AUTH_MODE="signin"; // "signin" or "signup"

function sbToggleMode(){
  SB_AUTH_MODE=SB_AUTH_MODE==="signin"?"signup":"signin";
  var submit=document.getElementById("auth-submit");
  var toggle=document.getElementById("auth-toggle");
  var nameField=document.getElementById("auth-name");
  if(SB_AUTH_MODE==="signup"){
    submit.textContent="Create Account";
    toggle.textContent="Already have an account? Sign in";
    nameField.style.display="block";
  }else{
    submit.textContent="Sign In";
    toggle.textContent="Create account";
    nameField.style.display="none";
  }
}

function sbHandleAuth(){
  var email=document.getElementById("auth-email").value.trim();
  var password=document.getElementById("auth-password").value;
  var name=document.getElementById("auth-name").value.trim()||email;
  if(!email||!password){alert("Please fill in all fields");return}
  document.getElementById("auth-form").style.display="none";
  document.getElementById("auth-loading").style.display="block";
  if(SB_AUTH_MODE==="signup"){
    sbSignUp(email,password,name)
  }else{
    sbSignIn(email,password)
  }
}

function showAuth(){
  document.getElementById("auth-screen").style.display="flex";
  document.getElementById("app-screen").style.display="none";
  document.getElementById("auth-form").style.display="block";
  document.getElementById("auth-loading").style.display="none";
}
function showApp(){
  if(typeof obNeeded==="function"&&obNeeded()){
    document.getElementById("auth-screen").style.display="none";
    document.getElementById("app-screen").style.display="none";
    if(typeof obStart==="function")setTimeout(function(){obStart()},300);
    return;
  }
  document.getElementById("auth-screen").style.display="none";
  document.getElementById("app-screen").style.display="block";
  if(typeof init==="function")init()
}

// Auto-detect existing session
function sbCheckSession(){
  if(!sb)return;
  sb.auth.getSession().then(function(r){
    if(r.data.session){
      SB_USER=r.data.session.user;
      document.getElementById("auth-name").textContent=SB_USER.user_metadata.name||SB_USER.email;
      sbLoadAll().then(function(){showApp()})
    }else{showAuth()}
  })
}

// ----- Intervals.icu Integration -----
function sbIntervalsConnected(){return !!(SB_USER&&_cache.intervalsApiKey&&_cache.intervalsAthleteId)}

async function sbLoadIntervalsSettings(){
  // Try localStorage first (instant)
  try{
    var lk=localStorage.getItem("ii_api_key");
    var la=localStorage.getItem("ii_athlete_id");
    if(lk&&la){_cache.intervalsApiKey=lk;_cache.intervalsAthleteId=la}
  }catch(e){}
  // Then try Supabase
  if(!SB_USER||!sb)return;
  try{
    var r=await sb.from("intervals_settings").select("api_key,athlete_id,athlete_name").eq("user_id",SB_USER.id).maybeSingle();
    if(r.data&&r.data.api_key){
      _cache.intervalsApiKey=r.data.api_key;
      _cache.intervalsAthleteId=r.data.athlete_id;
      _cache.intervalsAthleteName=r.data.athlete_name||"";
      // Sync localStorage with Supabase
      try{localStorage.setItem("ii_api_key",r.data.api_key);localStorage.setItem("ii_athlete_id",r.data.athlete_id)}catch(e){}
    }
  }catch(e){}
}

async function sbSaveIntervalsSettings(apiKey,athleteId){
  _cache.intervalsApiKey=apiKey;
  _cache.intervalsAthleteId=athleteId;
  // Always save to localStorage as fallback
  try{localStorage.setItem("ii_api_key",apiKey);localStorage.setItem("ii_athlete_id",athleteId)}catch(e){}
  if(!SB_USER||!sb)return;
  try{
    var r=await sb.from("intervals_settings").upsert({user_id:SB_USER.id,api_key:apiKey,athlete_id:athleteId,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(r.error)throw new Error(r.error.message);
  }catch(e){alert("Failed to save Intervals.icu settings: "+e.message)}
}

async function sbSyncIntervals(){
  if(!sbIntervalsConnected())return 0;
  var athleteId=_cache.intervalsAthleteId;
  var allActs=[];
  try{
    // Fetch in 30-day chunks to avoid hitting any API result limits
    var now2=new Date();
    for(var chunk=0;chunk<6;chunk++){
      var chunkEnd=new Date(now2);chunkEnd.setDate(chunkEnd.getDate()-(chunk*30));
      var chunkStart=new Date(chunkEnd);chunkStart.setDate(chunkStart.getDate()-30);
      var oldest=chunkStart.toISOString().substring(0,10);
      var newest=chunkEnd.toISOString().substring(0,10);
      var url="https://intervals.icu/api/v1/athlete/"+athleteId+"/activities?oldest="+oldest+"&newest="+newest;
      var resp=await fetch(url,{
        headers:{"Authorization":"Basic "+btoa("API_KEY:"+_cache.intervalsApiKey),"Accept":"application/json"}
      });
      if(!resp.ok){var txt=await resp.text();throw new Error("Chunk "+chunk+" API error "+resp.status+": "+txt.substring(0,200))}
      var acts=await resp.json();
      if(acts&&acts.length)allActs=allActs.concat(acts);
    }
  }catch(e){alert("Intervals.icu sync failed: "+e.message);return 0}
  if(!allActs||!allActs.length)return 0;
  // Map to app format
  var mapped=allActs.map(function(a){
    var t=a.type||"Workout";
    if(/ride/i.test(t))t="Ride";else if(/run/i.test(t))t="Run";else if(/swim/i.test(t))t="Swim";else if(/weight|strength/i.test(t))t="WeightTraining";else if(/virtual/i.test(t))t="VirtualRide";
    var lat=null,lng=null;
    if(a.start_latlng&&Array.isArray(a.start_latlng)&&a.start_latlng.length>=2){lat=a.start_latlng[0];lng=a.start_latlng[1]}
    else if(a.location&&Array.isArray(a.location)&&a.location.length>=2){lat=a.location[0];lng=a.location[1]}
    return{
      id:"ii_"+a.id,user_id:SB_USER.id,
      data:{
        x:a.suffer_score||a.intensity||0,m:a.moving_time||a.elapsed_time||0,e:a.total_elevation_gain||0,
        s:a.start_date,n:a.name||"",d:a.distance||0,
        p:a.average_speed||0,t:t,h:a.average_heartrate||0,
        u:a.suffer_score||a.intensity||0,lat:lat,lng:lng
      },
      start_date:a.start_date
    }
  });
  // Upsert in batches
  for(var i=0;i<mapped.length;i+=50){
    var batch=mapped.slice(i,i+50);
    try{await sb.from("intervals_activities").upsert(batch,{onConflict:"id"})}catch(e){}
  }
  // Fetch weather for activities with location
  var needWeather=[];
  for(var i=0;i<mapped.length;i++){var a=mapped[i];if(a.data.lat&&a.data.lng&&!a.data.wx)needWeather.push(a)}
  if(needWeather.length>0){
    var wbatch=[];
    for(var j=0;j<needWeather.length;j++){
      var a2=needWeather[j];
      try{
        var wx=await sbFetchWeather(a2.data.lat,a2.data.lng,a2.data.s.substring(0,10));
        if(wx){a2.data.wx=wx;wbatch.push({id:a2.id,user_id:SB_USER.id,data:a2.data,start_date:a2.start_date})}
      }catch(e){}
    }
    if(wbatch.length>0){
      for(var k=0;k<wbatch.length;k+=50)try{await sb.from("intervals_activities").upsert(wbatch.slice(k,k+50),{onConflict:"id"})}catch(e){}
    }
  }
  window.A=mapped.map(function(m){return m.data});
  return mapped.length
}

async function sbFetchWeather(lat,lng,dateStr){
  var url="https://archive-api.open-meteo.com/v1/archive?latitude="+lat+"&longitude="+lng+"&start_date="+dateStr+"&end_date="+dateStr+"&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto";
  var resp=await fetch(url);if(!resp.ok)return null;
  var data=await resp.json();if(!data.hourly)return null;
  var hr=new Date(dateStr).getHours(),idx=0,best=999;
  for(var i=0;i<data.hourly.time.length;i++){
    var h=parseInt(data.hourly.time[i].substring(11,13));
    var diff=Math.abs(h-hr);if(diff<best){best=diff;idx=i}
  }
  return{temp:Math.round(data.hourly.temperature_2m[idx]),humidity:data.hourly.relative_humidity_2m[idx],wind:data.hourly.wind_speed_10m[idx],code:data.hourly.weather_code[idx]}
}

async function sbLoadIntervalsActivities(){
  if(!SB_USER||!sb)return;
  var sixMo=new Date();sixMo.setDate(sixMo.getDate()-180);
  var cutoff=sixMo.toISOString();
  var allActs=[];
  var from=0,limit=1000;
  try{
    while(true){
      var r=await sb.from("intervals_activities").select("data").eq("user_id",SB_USER.id).gte("start_date",cutoff).order("start_date",{ascending:false}).range(from,from+limit-1);
      if(!r.data||!r.data.length)break;
      for(var i=0;i<r.data.length;i++)allActs.push(r.data[i].data);
      if(r.data.length<limit)break;
      from+=limit
    }
  }catch(e){}
  if(allActs.length>0){window.A=allActs}
  // If nothing in cache but we have intervals connected, auto-sync in background
  if(allActs.length===0&&sbIntervalsConnected()){setTimeout(function(){sbSyncIntervals().then(function(n){if(n>0)location.reload()}).catch(function(){})},500)}
}

// ----- Routine Trainings -----
async function sbLoadRoutines(){
  if(!SB_USER||!sb)return;
  var r=await sb.from("routine_trainings").select("*").eq("user_id",SB_USER.id).order("day_of_week,time_str");
  _cache.routines=r.data||[];
}

async function sbSaveRoutines(data){
  _cache.routines=data;
  if(!SB_READY||!SB_USER)return;
  try{
    await sb.from("routine_trainings").delete().eq("user_id",SB_USER.id);
    if(data.length>0){
      var rows=data.map(function(r){return{user_id:SB_USER.id,name:r.name,type:r.type,day_of_week:r.day_of_week,time_str:r.time_str||"",duration:r.duration||"",dist:r.dist||"",zone:r.zone||"Z2",note:r.note||""}});
      await sb.from("routine_trainings").insert(rows);
    }
  }catch(e){}
}

function sbGetRoutines(){return _cache.routines||[]}

// ----- AI Usage / Rate Limiting -----
var AI_DAILY_LIMIT=10;
var AI_EXEMPT_EMAILS=["leochiu@duck.com"];

function _sbIsExempt(){
  if(!SB_USER)return false;
  var email=(SB_USER.email||"").toLowerCase();
  for(var i=0;i<AI_EXEMPT_EMAILS.length;i++){if(email===AI_EXEMPT_EMAILS[i])return true}
  return false;
}

async function sbCheckAILimit(){
  if(_sbIsExempt())return{allowed:true,used:0,limit:AI_DAILY_LIMIT};
  if(!SB_USER||!sb)return{allowed:false,used:0,limit:AI_DAILY_LIMIT};
  try{
    var today=new Date().toISOString().substring(0,10);
    var r=await sb.from("ai_usage").select("id",{count:"exact"}).eq("user_id",SB_USER.id).eq("usage_date",today);
    var used=r.count||0;
    return{allowed:used<AI_DAILY_LIMIT,used:used,limit:AI_DAILY_LIMIT};
  }catch(e){return{allowed:false,used:0,limit:AI_DAILY_LIMIT}}
}

async function sbLogAIUsage(type){
  if(_sbIsExempt())return;
  if(!SB_USER||!sb)return;
  try{
    await sb.from("ai_usage").insert({user_id:SB_USER.id,usage_date:new Date().toISOString().substring(0,10),call_type:type||"plan"});
  }catch(e){}
}

// Bootstrap
(function(){
  if(sbInit()){
    sbCheckSession()
  }else{
    // Supabase SDK not loaded yet - wait for it
    window.addEventListener("load",function(){
      if(sbInit())sbCheckSession()
    })
  }
})();
