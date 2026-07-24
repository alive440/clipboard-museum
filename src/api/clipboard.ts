const DB_NAME='clipboard_museum'
const STORE_CLIPS='history'
const STORE_MEMOS='memos'
const STORE_SETTINGS='settings'
const DB_VERSION=2

export interface ClipEntry{id:number;content:string;type:'text'|'link'|'code'|'image';hash:string;length:number;pinned:boolean;createdAt:number}
export interface MemoEntry{id:number;title:string;content:string;createdAt:number;updatedAt:number}

function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE_CLIPS)){const s=db.createObjectStore(STORE_CLIPS,{keyPath:'id',autoIncrement:true});s.createIndex('hash','hash',{unique:true});s.createIndex('createdAt','createdAt');s.createIndex('type','type');s.createIndex('pinned','pinned')}else{const st=req.transaction!.objectStore(STORE_CLIPS);if(!st.indexNames.contains('pinned'))st.createIndex('pinned','pinned')}if(!db.objectStoreNames.contains(STORE_MEMOS)){const m=db.createObjectStore(STORE_MEMOS,{keyPath:'id',autoIncrement:true});m.createIndex('createdAt','createdAt')}if(!db.objectStoreNames.contains(STORE_SETTINGS)){db.createObjectStore(STORE_SETTINGS)}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}

function detectType(content:string):ClipEntry['type']{if(content.startsWith('data:image'))return'image';if(/^https?:\/\//.test(content.trim()))return'link';if(content.includes('\n')&&/[{};=<>]/.test(content))return'code';return'text'}
function hashContent(content:string):string{let hash=0;const limit=content.startsWith('data:image')?3000:500;for(let i=0;i<Math.min(content.length,limit);i++){hash=((hash<<5)-hash)+content.charCodeAt(i);hash|=0}return hash.toString(36)+(content.startsWith('data:image')?'_img':'')}

export async function addClipEntry(content:string):Promise<ClipEntry|null>{if(!content.trim())return null;const db=await openDB();const hash=hashContent(content);const type=detectType(content);return new Promise((resolve)=>{const tx=db.transaction(STORE_CLIPS,'readwrite');tx.objectStore(STORE_CLIPS).index('hash').getKey(hash).onsuccess=(e:any)=>{if(e.target.result){resolve(null);return}const entry={content,type,hash,length:content.length,pinned:false,createdAt:Date.now()};const addReq=tx.objectStore(STORE_CLIPS).add(entry as any);addReq.onsuccess=()=>resolve({...entry,id:addReq.result as number});addReq.onerror=()=>resolve(null)}})}

export async function getHistory(limit=200):Promise<ClipEntry[]>{const db=await openDB();return new Promise((resolve)=>{const pinned:ClipEntry[]=[];const recent:ClipEntry[]=[];db.transaction(STORE_CLIPS,'readonly').objectStore(STORE_CLIPS).index('createdAt').openCursor(null,'prev').onsuccess=(e:any)=>{const cursor=e.target.result;if(cursor){if(cursor.value.pinned)pinned.push(cursor.value);else if(recent.length<limit)recent.push(cursor.value);cursor.continue()}else{pinned.sort((a,b)=>b.createdAt-a.createdAt);resolve([...pinned,...recent])}}})}

export async function togglePin(id:number):Promise<boolean>{const db=await openDB();return new Promise((resolve)=>{const tx=db.transaction(STORE_CLIPS,'readwrite');const req=tx.objectStore(STORE_CLIPS).get(id);req.onsuccess=()=>{const entry=req.result;if(!entry){resolve(false);return};entry.pinned=!entry.pinned;tx.objectStore(STORE_CLIPS).put(entry);tx.oncomplete=()=>resolve(true)}})}

export async function searchHistory(query:string):Promise<ClipEntry[]>{const history=await getHistory(500);const q=query.toLowerCase();return history.filter(e=>e.type!=='image'&&e.content.toLowerCase().includes(q))}

export async function deleteEntry(id:number):Promise<void>{const db=await openDB();return new Promise((resolve)=>{db.transaction(STORE_CLIPS,'readwrite').objectStore(STORE_CLIPS).delete(id);resolve()})}

export async function cleanupOld(days:number):Promise<number>{const db=await openDB();const cutoff=Date.now()-days*86400000;let count=0;return new Promise((resolve)=>{const tx=db.transaction(STORE_CLIPS,'readwrite');tx.objectStore(STORE_CLIPS).index('createdAt').openCursor(IDBKeyRange.upperBound(cutoff)).onsuccess=(e:any)=>{const cursor=e.target.result;if(cursor&&!cursor.value.pinned){cursor.delete();count++;cursor.continue()}else if(cursor){cursor.continue()}else{resolve(count)}}})}

export async function getMemos():Promise<MemoEntry[]>{const db=await openDB();return new Promise((resolve)=>{const results:MemoEntry[]=[];db.transaction(STORE_MEMOS,'readonly').objectStore(STORE_MEMOS).index('createdAt').openCursor(null,'desc').onsuccess=(e:any)=>{const cursor=e.target.result;if(cursor){results.push(cursor.value);cursor.continue()}else{resolve(results)}}})}

export async function saveMemo(memo:Omit<MemoEntry,'id'>):Promise<MemoEntry>{const db=await openDB();return new Promise((resolve)=>{const req=db.transaction(STORE_MEMOS,'readwrite').objectStore(STORE_MEMOS).add(memo as any);req.onsuccess=()=>resolve({...memo,id:req.result as number})})}

export async function deleteMemo(id:number):Promise<void>{const db=await openDB();return new Promise((resolve)=>{db.transaction(STORE_MEMOS,'readwrite').objectStore(STORE_MEMOS).delete(id);resolve()})}

export async function getSetting(key:string,fallback:number=30):Promise<number>{const db=await openDB();return new Promise((resolve)=>{const req=db.transaction(STORE_SETTINGS,'readonly').objectStore(STORE_SETTINGS).get(key);req.onsuccess=()=>resolve(req.result??fallback);req.onerror=()=>resolve(fallback)})}

export async function setSetting(key:string,value:number|string):Promise<void>{const db=await openDB();return new Promise((resolve)=>{db.transaction(STORE_SETTINGS,'readwrite').objectStore(STORE_SETTINGS).put(value,key);resolve()})}

export async function getSettingStr(key:string,fallback=''):Promise<string>{const db=await openDB();return new Promise((resolve)=>{const req=db.transaction(STORE_SETTINGS,'readonly').objectStore(STORE_SETTINGS).get(key);req.onsuccess=()=>resolve(typeof req.result==='string'?req.result:fallback);req.onerror=()=>resolve(fallback)})}

function simpleHash(s:string):string{let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0}return'pw_'+h.toString(36)}
export async function hasPassword():Promise<boolean>{return(await getSettingStr('lock_pw',''))!==''}
export async function checkPassword(pw:string):Promise<boolean>{return(await getSettingStr('lock_pw',''))===simpleHash(pw)}
export async function setPassword(pw:string):Promise<void>{await setSetting('lock_pw',pw?simpleHash(pw):'')}
