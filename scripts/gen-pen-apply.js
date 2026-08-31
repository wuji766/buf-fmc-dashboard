// gen-pen-apply.js — pen-patch-{key}.json -> 紧凑数值数组（按 elements 顺序，name=t{floor(j/130)*130}_{j%130}）
const fs = require('fs'), path = require('path');
const frames = { L20: 'mBior', L20x2: 'P3d7GZ', L40: 'ApTOU' };
for (const [key, fid] of Object.entries(frames)) {
  const patch = JSON.parse(fs.readFileSync(path.join(__dirname, `pen-patch-${key}.json`), 'utf8'));
  const D = patch.map(p => [+p.x.toFixed(2), +p.y.toFixed(2), +p.w.toFixed(2), +p.h.toFixed(2), p.fontSize]);
  const code = `const F=${JSON.stringify(fid)}\nconst D=${JSON.stringify(D)}\nlet n=0\nGet(F,(m)=>{if(m.type!=="text"||!/^t\\d+_\\d+$/.test(m.name||""))return null\nconst j=n++;const d=D[j];if(!d)return null\nUpdate(m.id,{x:d[0],y:d[1],width:d[2],height:d[3],fontSize:d[4],textAlignVertical:"middle"})\nreturn null})\nPrint(JSON.stringify({applied:n,total:D.length}))`;
  fs.writeFileSync(path.join(__dirname, 'snippets', `pen-apply-${key}.js`), code);
  console.log(key, D.length, 'entries,', code.length, 'chars');
}
