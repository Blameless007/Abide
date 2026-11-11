
const KEY = "abide.v1.data";

const verses = [
  {text:"Abide in me, and I in you.",ref:"John 15:4"},
  {text:"Be still, and know that I am God.",ref:"Psalm 46:10"},
  {text:"Pray without ceasing.",ref:"1 Thessalonians 5:17"},
  {text:"Draw near to God, and he will draw near to you.",ref:"James 4:8"},
  {text:"The Lord is near to all who call on him, to all who call on him in truth.",ref:"Psalm 145:18"},
  {text:"In the morning, Lord, you hear my voice; in the morning I lay my requests before you and wait expectantly.",ref:"Psalm 5:3"},
  {text:"Let the word of Christ dwell in you richly.",ref:"Colossians 3:16"}
];

const defaults = {
  schedule:[
    {id:"p1",name:"Morning prayer",time:"06:00"},
    {id:"p2",name:"Midday pause",time:"12:30"},
    {id:"p3",name:"Evening prayer",time:"20:30"}
  ],
  checkins:[],
  journals:[]
};

let data = structuredClone(defaults);
let editingPrayerId = null;
let timerSeconds = 0;
let timerInterval = null;

const $ = id => document.getElementById(id);

function saveData(){
  localStorage.setItem(KEY, JSON.stringify(data));
  const snapshot = structuredClone(data);

  saveQueue = saveQueue.then(
    () => window.AbideDB.saveAppData(snapshot)
  ).catch(error => {
    console.error(error);
    toast("Database save failed. Please reload.");
  });

  return saveQueue;
}

let saveQueue = Promise.resolve();

function dateKey(d=new Date()){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

function getPrayerStreak(){
  const completedDays = new Set(data.checkins.map(c => c.day));
  let cursor = new Date();
  cursor.setHours(0,0,0,0);

  if(!completedDays.has(dateKey(cursor))){
    cursor.setDate(cursor.getDate()-1);
  }

  let streak = 0;

  while(completedDays.has(dateKey(cursor))){
    streak++;
    cursor.setDate(cursor.getDate()-1);
  }

  return streak;
}

function updatePrayerStreak(){
  const streak = getPrayerStreak();
  $("prayerStreak").textContent = streak;

  $("streakMessage").textContent = streak === 0
    ? "Your journey starts with one prayer."
    : streak === 1
    ? "You've started building consistency. Keep going!"
    : "You've shown up for God " + streak + " days in a row. Keep going!";
}

function escapeHTML(s=""){
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function toast(msg){
  const t=$("toast");
  t.textContent=msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2400);
}

function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("selected",b.dataset.view===id));

  if(id==="historyView")renderHistory();
  if(id==="journalView")renderJournals();
  if(id==="settingsView")renderSettings();

  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll(".nav-item[data-view]").forEach(b=>
  b.addEventListener("click",()=>showView(b.dataset.view))
);

$("journeyShortcut").onclick=()=>showView("historyView");
$("settingsShortcut").onclick=()=>showView("settingsView");
$("bibleTab").onclick=()=>window.location.href="https://www.bible.com/";
$("settingsBtn").onclick=()=>showView("settingsView");
$("manageSchedule").onclick=()=>showView("settingsView");
$("quickJournal").onclick=()=>{
  showView("journalView");
  $("journalBody").focus();
};

async function init(){
  try{
    const stored = await window.AbideDB.loadAppData();
    data = {...defaults,...(stored || {})};
    await window.AbideDB.saveAppData(data);
    localStorage.setItem(KEY,JSON.stringify(data));
  }catch(error){
    console.error(error);
    toast("Unable to load saved data. Please reload.");
    return;
  }

  const now = new Date();
  const hour = now.getHours();

  $("greetingText").textContent = hour < 12
    ? "GOOD MORNING"
    : hour < 17
    ? "GOOD AFTERNOON"
    : "GOOD EVENING";

  $("todayLabel").textContent = now.toLocaleDateString(
    undefined,
    {weekday:"short",month:"short",day:"numeric"}
  );

  try{
    const dayNumber = Math.floor(
      Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()) / 86400000
    );

    const fallbackVerse = verses[
      ((dayNumber % verses.length) + verses.length) % verses.length
    ];

    const dailyContent = await window.AbideDailyContent.getForDate(
      now,
      fallbackVerse
    );

    $("welcomeMessage").textContent = dailyContent.welcome;
    $("verseText").textContent = "“" + dailyContent.scripture.text + "”";
    $("verseRef").textContent = dailyContent.scripture.ref;

  }catch(error){
    console.error("Daily content error:",error);

    const fallback = verses[
      Math.floor(Date.now()/86400000) % verses.length
    ];

    $("welcomeMessage").textContent =
      window.AbideDailyContent?.getWelcomeMessage?.(now) ||
      "You don't have to rush. Come as you are.";

    $("verseText").textContent = "“" + fallback.text + "”";
    $("verseRef").textContent = fallback.ref;
  }

  renderPrayerList();
  renderJournals();
  renderHistory();

  $("journalBody").addEventListener("input",()=>{
    $("wordCount").textContent =
      ($("journalBody").value.trim().match(/\S+/g)||[]).length+" words";
  });
}

function isDone(id,day=dateKey()){
  return data.checkins.some(c=>c.id===id&&c.day===day);
}

function renderPrayerList(){
  const host=$("prayerList");

  if(!data.schedule.length){
    host.innerHTML='<div class="empty-state">Your prayer rhythm starts with one moment.<br>Open Settings to add a prayer time.</div>';
  }else{
    host.innerHTML=[...data.schedule]
      .sort((a,b)=>a.time.localeCompare(b.time))
      .map(p=>`
        <div class="prayer-row">
          <div class="prayer-icon">♡</div>
          <div class="prayer-info">
            <strong>${escapeHTML(p.name)}</strong>
            <small>${formatTime(p.time)}</small>
          </div>
          <button class="check-button ${isDone(p.id)?"done":""}" data-check="${p.id}">
            ${isDone(p.id)?"✓ Checked in":"Check in"}
          </button>
        </div>
      `).join("");
  }

  host.querySelectorAll("[data-check]").forEach(b=>
    b.onclick=()=>checkIn(b.dataset.check)
  );

  const done=data.schedule.filter(p=>isDone(p.id)).length;
  const total=data.schedule.length;

  $("progressText").textContent=`${done} of ${total} completed`;
  $("progressBar").style.width=(total?done/total*100:0)+"%";

  $("progressEncouragement").textContent=
    total&&done===total
      ?"You've made room for every moment today. Grace for tomorrow, too."
      :done
      ?"Every moment of turning toward God matters."
      :"Small, faithful moments matter.";

  updatePrayerStreak();
}

function formatTime(t){
  const [h,m]=t.split(":").map(Number);
  return new Date(2000,0,1,h,m).toLocaleTimeString(
    [],
    {hour:"numeric",minute:"2-digit"}
  );
}

function checkIn(id){
  const p=data.schedule.find(x=>x.id===id);
  if(!p)return;

  if(!isDone(id)){
    data.checkins.push({
      id,
      day:dateKey(),
      at:new Date().toISOString()
    });

    saveData();
    renderPrayerList();

    $("sessionTitle").textContent=p.name;
    $("sessionPrompt").textContent="You've made space for this moment. Breathe, pray honestly, and be present.";
    $("sessionTitle").dataset.prayerId=id;

    showView("prayerView");
    toast("Prayer check-in saved. Take your time.");
  }else{
    toast("You've already checked in for this moment today.");
  }
}

$("startTimer").onclick=()=>{
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval=null;
    $("startTimer").textContent="Resume prayer";
    return;
  }

  timerInterval=setInterval(()=>{
    timerSeconds++;
    $("timer").textContent=
      String(Math.floor(timerSeconds/60)).padStart(2,"0")+":"+
      String(timerSeconds%60).padStart(2,"0");
  },1000);

  $("startTimer").textContent="Pause timer";
};

$("finishPrayer").onclick=()=>{
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval=null;
  }

  timerSeconds=0;
  $("timer").textContent="00:00";
  $("startTimer").textContent="Begin prayer";

  toast("Thank you for making room for prayer.");
  showView("homeView");
};

$("journalForm").onsubmit=e=>{
  e.preventDefault();

  const body=$("journalBody").value.trim();
  if(!body)return;

  data.journals.unshift({
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    title:$("journalTitle").value.trim()||"Untitled reflection",
    body,
    createdAt:new Date().toISOString()
  });

  saveData();

  $("journalTitle").value="";
  $("journalBody").value="";
  $("wordCount").textContent="0 words";

  renderJournals();
  renderHistory();

  toast("Your reflection has been saved on this device.");
};

function renderJournals(){
  $("entryCount").textContent=data.journals.length+" "+
    (data.journals.length===1?"entry":"entries");

  $("journalEntries").innerHTML=data.journals.length
    ?data.journals.map(j=>`
      <article class="entry-card">
        <div class="entry-card-top">
          <div>
            <h3>${escapeHTML(j.title)}</h3>
            <span class="entry-date">
              ${new Date(j.createdAt).toLocaleString([],{
                dateStyle:"medium",
                timeStyle:"short"
              })}
            </span>
          </div>
          <button class="delete-entry" data-delete="${j.id}">Delete</button>
        </div>
        <p class="entry-body">${escapeHTML(j.body)}</p>
      </article>
    `).join("")
    :'<div class="empty-state">Your reflections will appear here.<br>Start with a sentence. There is no perfect way to journal.</div>';

  $("journalEntries").querySelectorAll("[data-delete]").forEach(b=>
    b.onclick=()=>{
      if(confirm("Delete this reflection? This cannot be undone.")){
        data.journals=data.journals.filter(j=>j.id!==b.dataset.delete);
        saveData();
        renderJournals();
        renderHistory();
      }
    }
  );
}

function renderHistory(){
  $("totalCheckins").textContent=data.checkins.length;
  $("totalJournals").textContent=data.journals.length;

  const days=[];

  for(let i=6;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const key=dateKey(d);

    days.push({
      label:d.toLocaleDateString([],{weekday:"short"}),
      count:data.checkins.filter(c=>c.day===key).length
    });
  }

  const max=Math.max(1,...days.map(d=>d.count));

  $("weekBars").innerHTML=days.map(d=>`
    <div class="week-day">
      <i style="height:${Math.max(4,d.count/max*72)}px"></i>
      <small>${d.label}</small>
    </div>
  `).join("");
}

function renderSettings(){
  $("settingsSchedule").innerHTML=data.schedule.length
    ?[...data.schedule]
      .sort((a,b)=>a.time.localeCompare(b.time))
      .map(p=>`
        <div class="schedule-setting">
          <strong>${escapeHTML(p.name)}</strong>
          <time>${formatTime(p.time)}</time>
          <button data-edit="${p.id}" aria-label="Edit ${escapeHTML(p.name)}">✎</button>
          <button data-remove="${p.id}" aria-label="Remove ${escapeHTML(p.name)}">×</button>
        </div>
      `).join("")
    :'<div class="empty-state">No prayer moments yet. Add one to begin.</div>';

  $("settingsSchedule").querySelectorAll("[data-edit]").forEach(b=>
    b.onclick=()=>openPrayerModal(b.dataset.edit)
  );

  $("settingsSchedule").querySelectorAll("[data-remove]").forEach(b=>
    b.onclick=()=>{
      if(confirm("Remove this prayer time? Your past check-ins will remain in your history.")){
        data.schedule=data.schedule.filter(p=>p.id!==b.dataset.remove);
        saveData();
        renderSettings();
        renderPrayerList();
      }
    }
  );
}

function openPrayerModal(id=null){
  editingPrayerId=id;
  const p=data.schedule.find(x=>x.id===id);

  $("prayerModalTitle").textContent=p?"Edit prayer moment":"Add a prayer moment";
  $("prayerName").value=p?.name||"";
  $("prayerTime").value=p?.time||"06:00";
  $("prayerModal").hidden=false;
}

$("addPrayer").onclick=()=>openPrayerModal();

$("prayerForm").onsubmit=e=>{
  e.preventDefault();

  const name=$("prayerName").value.trim();
  const time=$("prayerTime").value;

  if(!name||!time)return;

  if(editingPrayerId){
    const p=data.schedule.find(x=>x.id===editingPrayerId);
    if(p){
      p.name=name;
      p.time=time;
    }
  }else{
    data.schedule.push({
      id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
      name,
      time
    });
  }

  saveData();
  $("prayerModal").hidden=true;
  renderSettings();
  renderPrayerList();
  toast("Your prayer rhythm has been updated.");
};

document.querySelectorAll("[data-close]").forEach(b=>
  b.onclick=()=>$(b.dataset.close).hidden=true
);

$("prayerModal").addEventListener("click",e=>{
  if(e.target===$("prayerModal")){
    $("prayerModal").hidden=true;
  }
});

function downloadBackup(){
  const blob=new Blob([
    JSON.stringify({
      exportedAt:new Date().toISOString(),
      ...data
    },null,2)
  ],{type:"application/json"});

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download="abide-backup-"+dateKey()+".json";
  a.click();

  URL.revokeObjectURL(url);
  toast("Your backup is ready.");
}

$("downloadBackup").onclick=downloadBackup;
$("exportData").onclick=downloadBackup;

$("testMigration").onclick=async()=>{
  try{
    const result=await window.AbideDB.migrateLegacyData();

    if(result.alreadyMigrated){
      toast("Migration was already completed.");
    }else if(result.noLegacyData){
      toast("No previous data found.");
    }else{
      toast(`Copied ${result.schedules} schedules, ${result.checkins} check-ins and ${result.journals} journal entries.`);
    }
  }catch(error){
    console.error(error);
    toast("Migration failed. Your original data is still safe.");
  }
};

$("clearData").onclick=()=>{
  if(confirm("This permanently clears your prayer schedule, check-ins, and journal from this browser. Download a backup first if you want to keep them.")){
    data={
      ...structuredClone(defaults),
      schedule:[],
      checkins:[],
      journals:[]
    };

    saveData();
    renderSettings();
    renderPrayerList();
    renderJournals();
    renderHistory();

    toast("Your personal prayer data has been cleared.");
  }
};

init();
te this reflection? This cannot be undone.")){
        data.journals=data.journals.filter(j=>j.id!==b.dataset.delete);
        saveData();
        renderJournals();
        renderHistory();
      }
    }
  );
}

function renderHistory(){
  $("totalCheckins").textContent=data.checkins.length;
  $("totalJournals").textContent=data.journals.length;

  const days=[];

  for(let i=6;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const key=dateKey(d);

    days.push({
      label:d.toLocaleDateString([],{weekday:"short"}),
      count:data.checkins.filter(c=>c.day===key).length
    });
  }

  const max=Math.max(1,...days.map(d=>d.count));

  $("weekBars").innerHTML=days.map(d=>`
    <div class="week-day">
      <i style="height:${Math.max(4,d.count/max*72)}px"></i>
      <small>${d.label}</small>
    </div>
  `).join("");
}

function renderSettings(){
  $("settingsSchedule").innerHTML=data.schedule.length
    ?[...data.schedule]
      .sort((a,b)=>a.time.localeCompare(b.time))
      .map(p=>`
        <div class="schedule-setting">
          <strong>${escapeHTML(p.name)}</strong>
          <time>${formatTime(p.time)}</time>
          <button data-edit="${p.id}" aria-label="Edit ${escapeHTML(p.name)}">✎</button>
          <button data-remove="${p.id}" aria-label="Remove ${escapeHTML(p.name)}">×</button>
        </div>
      `).join("")
    :'<div class="empty-state">No prayer moments yet. Add one to begin.</div>';

  $("settingsSchedule").querySelectorAll("[data-edit]").forEach(b=>
    b.onclick=()=>openPrayerModal(b.dataset.edit)
  );

  $("settingsSchedule").querySelectorAll("[data-remove]").forEach(b=>
    b.onclick=()=>{
      if(confirm("Remove this prayer time? Your past check-ins will remain in your history.")){
        data.schedule=data.schedule.filter(p=>p.id!==b.dataset.remove);
        saveData();
        renderSettings();
        renderPrayerList();
      }
    }
  );
}

function openPrayerModal(id=null){
  editingPrayerId=id;
  const p=data.schedule.find(x=>x.id===id);

  $("prayerModalTitle").textContent=p?"Edit prayer moment":"Add a prayer moment";
  $("prayerName").value=p?.name||"";
  $("prayerTime").value=p?.time||"06:00";
  $("prayerModal").hidden=false;
}

$("addPrayer").onclick=()=>openPrayerModal();

$("prayerForm").onsubmit=e=>{
  e.preventDefault();

  const name=$("prayerName").value.trim();
  const time=$("prayerTime").value;

  if(!name||!time)return;

  if(editingPrayerId){
    const p=data.schedule.find(x=>x.id===editingPrayerId);
    if(p){
      p.name=name;
      p.time=time;
    }
  }else{
    data.schedule.push({
      id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
      name,
      time
    });
  }

  saveData();
  $("prayerModal").hidden=true;
  renderSettings();
  renderPrayerList();
  toast("Your prayer rhythm has been updated.");
};

document.querySelectorAll("[data-close]").forEach(b=>
  b.onclick=()=>$(b.dataset.close).hidden=true
);

$("prayerModal").addEventListener("click",e=>{
  if(e.target===$("prayerModal")){
    $("prayerModal").hidden=true;
  }
});

function downloadBackup(){
  const blob=new Blob([
    JSON.stringify({
      exportedAt:new Date().toISOString(),
      ...data
    },null,2)
  ],{type:"application/json"});

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download="abide-backup-"+dateKey()+".json";
  a.click();

  URL.revokeObjectURL(url);
  toast("Your backup is ready.");
}

$("downloadBackup").onclick=downloadBackup;
$("exportData").onclick=downloadBackup;

$("testMigration").onclick=async()=>{
  try{
    const result=await window.AbideDB.migrateLegacyData();

    if(result.alreadyMigrated){
      toast("Migration was already completed.");
    }else if(result.noLegacyData){
      toast("No previous data found.");
    }else{
      toast(`Copied ${result.schedules} schedules, ${result.checkins} check-ins and ${result.journals} journal entries.`);
    }
  }catch(error){
    console.error(error);
    toast("Migration failed. Your original data is still safe.");
  }
};

$("clearData").onclick=()=>{
  if(confirm("This permanently clears your prayer schedule, check-ins, and journal from this browser. Download a backup first if you want to keep them.")){
    data={
      ...structuredClone(defaults),
      schedule:[],
      checkins:[],
      journals:[]
    };

    saveData();
    renderSettings();
    renderPrayerList();
    renderJournals();
    renderHistory();

    toast("Your personal prayer data has been cleared.");
  }
};

init();
nderJournals();
        renderHistory();
      }
    }
  );
}

function renderHistory(){
  $("totalCheckins").textContent=data.checkins.length;
  $("totalJournals").textContent=data.journals.length;

  const days=[];

  for(let i=6;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const key=dateKey(d);

    days.push({
      label:d.toLocaleDateString([],{weekday:"short"}),
      count:data.checkins.filter(c=>c.day===key).length
    });
  }

  const max=Math.max(1,...days.map(d=>d.count));

  $("weekBars").innerHTML=days.map(d=>`
    <div class="week-day">
      <i style="height:${Math.max(4,d.count/max*72)}px"></i>
      <small>${d.label}</small>
    </div>
  `).join("");
}

function renderSettings(){
  $("settingsSchedule").innerHTML=data.schedule.length
    ?[...data.schedule]
      .sort((a,b)=>a.time.localeCompare(b.time))
      .map(p=>`
        <div class="schedule-setting">
          <strong>${escapeHTML(p.name)}</strong>
          <time>${formatTime(p.time)}</time>
          <button data-edit="${p.id}" aria-label="Edit ${escapeHTML(p.name)}">✎</button>
          <button data-remove="${p.id}" aria-label="Remove ${escapeHTML(p.name)}">×</button>
        </div>
      `).join("")
    :'<div class="empty-state">No prayer moments yet. Add one to begin.</div>';

  $("settingsSchedule").querySelectorAll("[data-edit]").forEach(b=>
    b.onclick=()=>openPrayerModal(b.dataset.edit)
  );

  $("settingsSchedule").querySelectorAll("[data-remove]").forEach(b=>
    b.onclick=()=>{
      if(confirm("Remove this prayer time? Your past check-ins will remain in your history.")){
        data.schedule=data.schedule.filter(p=>p.id!==b.dataset.remove);
        saveData();
        renderSettings();
        renderPrayerList();
      }
    }
  );
}

function openPrayerModal(id=null){
  editingPrayerId=id;
  const p=data.schedule.find(x=>x.id===id);

  $("prayerModalTitle").textContent=p?"Edit prayer moment":"Add a prayer moment";
  $("prayerName").value=p?.name||"";
  $("prayerTime").value=p?.time||"06:00";
  $("prayerModal").hidden=false;
}

$("addPrayer").onclick=()=>openPrayerModal();

$("prayerForm").onsubmit=e=>{
  e.preventDefault();

  const name=$("prayerName").value.trim();
  const time=$("prayerTime").value;

  if(!name||!time)return;

  if(editingPrayerId){
    const p=data.schedule.find(x=>x.id===editingPrayerId);
    if(p){
      p.name=name;
      p.time=time;
    }
  }else{
    data.schedule.push({
      id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
      name,
      time
    });
  }

  saveData();
  $("prayerModal").hidden=true;
  renderSettings();
  renderPrayerList();
  toast("Your prayer rhythm has been updated.");
};

document.querySelectorAll("[data-close]").forEach(b=>
  b.onclick=()=>$(b.dataset.close).hidden=true
);

$("prayerModal").addEventListener("click",e=>{
  if(e.target===$("prayerModal")){
    $("prayerModal").hidden=true;
  }
});

function downloadBackup(){
  const blob=new Blob([
    JSON.stringify({
      exportedAt:new Date().toISOString(),
      ...data
    },null,2)
  ],{type:"application/json"});

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download="abide-backup-"+dateKey()+".json";
  a.click();

  URL.revokeObjectURL(url);
  toast("Your backup is ready.");
}

$("downloadBackup").onclick=downloadBackup;
$("exportData").onclick=downloadBackup;

$("testMigration").onclick=async()=>{
  try{
    const result=await window.AbideDB.migrateLegacyData();

    if(result.alreadyMigrated){
      toast("Migration was already completed.");
    }else if(result.noLegacyData){
      toast("No previous data found.");
    }else{
      toast(`Copied ${result.schedules} schedules, ${result.checkins} check-ins and ${result.journals} journal entries.`);
    }
  }catch(error){
    console.error(error);
    toast("Migration failed. Your original data is still safe.");
  }
};

$("clearData").onclick=()=>{
  if(confirm("This permanently clears your prayer schedule, check-ins, and journal from this browser. Download a backup first if you want to keep them.")){
    data={
      ...structuredClone(defaults),
      schedule:[],
      checkins:[],
      journals:[]
    };

    saveData();
    renderSettings();
    renderPrayerList();
    renderJournals();
    renderHistory();

    toast("Your personal prayer data has been cleared.");
  }
};

init();
r moment":"Add a prayer moment";$("prayerName").value=p?.name||"";$("prayerTime").value=p?.time||"06:00";$("prayerModal").hidden=false}
$("addPrayer").onclick=()=>openPrayerModal();$("prayerForm").onsubmit=e=>{e.preventDefault();const name=$("prayerName").value.trim(),time=$("prayerTime").value;if(!name||!time)return;if(editingPrayerId){const p=data.schedule.find(x=>x.id===editingPrayerId);if(p){p.name=name;p.time=time}}else data.schedule.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,time});saveData();$("prayerModal").hidden=true;renderSettings();renderPrayerList();toast("Your prayer rhythm has been updated.")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).hidden=true);$("prayerModal").addEventListener("click",e=>{if(e.target===$("prayerModal"))$("prayerModal").hidden=true});
function downloadBackup(){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...data},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="abide-backup-"+dateKey()+".json";a.click();URL.revokeObjectURL(url);toast("Your backup is ready.")}$("downloadBackup").onclick=downloadBackup;$("exportData").onclick=downloadBackup;
$("testMigration").onclick = async () => {
  try {
    const result = await window.AbideDB.migrateLegacyData();

    if (result.alreadyMigrated) {
  toast("Migration was already completed.");
} else if (result.noLegacyData) {
  toast("No previous data found.");
} else {
  toast(`Copied ${result.schedules} schedules, ${result.checkins} check-ins and ${result.journals} journal entries.`);
}
  } catch (error) {
    console.error(error);
    toast("Migration failed. Your original data is still safe.");
  }
};
$("clearData").onclick=()=>{
  if(confirm("This permanently clears your prayer schedule, check-ins, and journal from this browser. Download a backup first if you want to keep them.")){
    data = {
      ...structuredClone(defaults),
      schedule: [],
      checkins: [],
      journals: []
    };

    saveData();
    renderSettings();
    renderPrayerList();
    renderJournals();
    renderHistory();
    toast("Your personal prayer data has been cleared.");
  }
};
init();
