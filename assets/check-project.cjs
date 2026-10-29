const fs=require('fs');
const assert=require('assert');
const {validateContact}=require('../app.js');
try {
const pages=['index.html','projects.html','about.html','contact.html'];
const checks=[];
for(const file of pages){
 const html=fs.readFileSync(file,'utf8');
 assert(html.includes('<html lang="ru">'),file+' language');
 assert(html.includes('</body></html>'),file+' complete document');
 assert(!/\{\{[^}]*\}\}|TODO|lorem ipsum/i.test(html),file+' placeholders');
 const ids=[...html.matchAll(/data-od-id="([^"]+)"/g)].map(x=>x[1]);
 assert(new Set(ids).size===ids.length,file+' duplicate design identifiers');
 const links=[...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map(x=>x[1]);
 for(const link of links)assert(fs.existsSync(link),file+' missing asset or page '+link);
 for(const tag of ['section','article','button','nav','main','header','footer','form','dialog','div']){
  const opens=(html.match(new RegExp('<'+tag+'(?:\\s|>)','g'))||[]).length;
  const closes=(html.match(new RegExp('</'+tag+'>','g'))||[]).length;
  assert(opens===closes,file+' unbalanced '+tag);
 }
 const imgs=[...html.matchAll(/<img[^>]*src="([^"]+)"[^>]*width="(\d+)"[^>]*height="(\d+)"/g)];
 for(const img of imgs){const b=fs.readFileSync(img[1]);assert(b.readUInt32BE(16)===Number(img[2])&&b.readUInt32BE(20)===Number(img[3]),'intrinsic image size '+img[1]);}
 checks.push({file,regions:ids.length,localLinks:links.length,images:imgs.length});
}
assert.deepStrictEqual(validateContact({name:'',email:'',message:''}),{name:'Подскажите, как к вам обращаться.',email:'Укажите почту для ответа.',message:'Расскажите немного об идее.'});
assert.deepStrictEqual(validateContact({name:' Анна ',email:'anna@example.com',message:'Хочу обсудить сайт-портфолио.'}),{});
assert(validateContact({name:'Анна',email:'anna@',message:'Коротко'}).email);
assert(validateContact({name:'  ',email:'a@b.com',message:'          '}).name);
assert(validateContact({name:'Анна',email:'a b@example.com',message:'Новая идея для сайта'}).email);
assert(validateContact({name:'Анна',email:'a@example.com',message:' Мало '}).message);

// Exact Tiny5 advance widths determine the longest display line at all requested widths.
const b=fs.readFileSync('assets/fonts/tiny5.ttf'),tables={};
for(let i=0;i<b.readUInt16BE(4);i++){const t=12+i*16;tables[b.toString('ascii',t,t+4)]=b.readUInt32BE(t+8);}
const upm=b.readUInt16BE(tables.head+18),numMetrics=b.readUInt16BE(tables.hhea+34);
let cmap=0;
for(let i=0;i<b.readUInt16BE(tables.cmap+2);i++){const s=tables.cmap+b.readUInt32BE(tables.cmap+8+i*8);if(b.readUInt16BE(s)===4)cmap=s;}
function gid(code){const seg=b.readUInt16BE(cmap+6)/2;for(let i=0;i<seg;i++){const e=b.readUInt16BE(cmap+14+i*2),s=b.readUInt16BE(cmap+16+seg*2+i*2);if(code>=s&&code<=e){const delta=b.readInt16BE(cmap+16+seg*4+i*2),addr=cmap+16+seg*6+i*2,ro=b.readUInt16BE(addr);if(!ro)return(code+delta)&65535;const g=b.readUInt16BE(addr+ro+2*(code-s));return g?(g+delta)&65535:0;}}return 0;}
function textWidth(text,size,spacing){return [...text].reduce((sum,ch)=>{const g=gid(ch.codePointAt(0));return sum+b.readUInt16BE(tables.hmtx+Math.min(g,numMetrics-1)*4)*size/upm;},0)+(text.length-1)*spacing*size;}
const widths=[360,390,430,600,768,820,1024,1366,1440,1920];
const typography=widths.map(width=>{
 const gutter=Math.min(72,Math.max(20,width*.042)),content=Math.min(1320,width-2*gutter);
 const column=width<=600?content:(content-(width>=1600?30:width<=820?0:12))*(width<=820?1.25/2.25:1.3/2.3);
 const size=width<=600?Math.min(78,Math.max(50,width*.142)):width<=820?width*.0845:width<=1100?width*.084:width>=1600?120:Math.min(124,Math.max(68,width*.0835));
 const line=textWidth('с характером.',size,width<=600?-.02:-.025);
 return {width,column:Math.round(column),font:Math.round(size),line:Math.round(line),fits:line<=column};
});
const otherTitles=widths.map(width=>{
 const gutter=Math.min(72,Math.max(20,width*.042)),content=Math.min(1320,width-2*gutter);
 const projectColumn=width<=600?content:(content-(width<=820?25:50))*1.3/2.3;
 const projectSize=width<=600?Math.min(78,Math.max(49,width*.13)):width<=820?Math.min(64,Math.max(54,width*.076)):Math.min(110,Math.max(64,width*.076));
 const contactColumn=width<=600?content:content*(1-(width<=820?.06:width<=1100?.07:.12))/2.1;
 const contactSize=width<=600?Math.min(82,Math.max(58,width*.14)):width<=820?Math.min(60,Math.max(54,width*.072)):Math.min(100,Math.max(64,width*.07));
 const pl=textWidth('Три характера.',projectSize,-.018),cl=textWidth('что-то своё.',contactSize,-.018);
 return {width,projectColumn:Math.round(projectColumn),projectLine:Math.round(pl),contactColumn:Math.round(contactColumn),contactLine:Math.round(cl),fits:pl<=projectColumn&&cl<=contactColumn};
});
fs.writeFileSync('assets/check-results.json',JSON.stringify({pages:checks,validation:'6 contact cases passed',typography,otherTitles},null,2));
if(typography.some(t=>!t.fits)||otherTitles.some(t=>!t.fits))process.exitCode=1;
} catch(error) {fs.writeFileSync('assets/check-results.json',JSON.stringify({error:error.message,stack:error.stack},null,2));process.exitCode=1;}
