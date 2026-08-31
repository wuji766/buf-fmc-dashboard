// 生成竖排文字绝对值应用片段（按内容队列匹配，不动 rotation）
const fs = require('fs'), path = require('path');
const frames = { L20: 'mBior', L20x2: 'P3d7GZ', L40: 'ApTOU' };
for (const [key, fid] of Object.entries(frames)) {
  const patch = JSON.parse(fs.readFileSync(path.join(__dirname, `rot-patch-${key}.json`), 'utf8'));
  const D = patch.map(p => [p.content, p.x, p.y, p.w, p.h, p.fontSize]);
  const code = `const F=${JSON.stringify(fid)}\nconst D=${JSON.stringify(D)}\nconst Q={}\nfor(const d of D){(Q[d[0]]=Q[d[0]]||[]).push(d)}\nlet n=0\nGet(F,(m)=>{if(m.type!=="text"||!/^t\\d+_\\d+$/.test(m.name||""))return null\nif(m.rotation!==90&&m.rotation!==270)return null\nconst q=Q[m.content];if(!q||!q.length)return null\nconst d=q.shift()\nUpdate(m.id,{x:d[1],y:d[2],width:d[3],height:d[4],fontSize:d[5]})\nn++\nreturn null})\nPrint(JSON.stringify({applied:n,total:D.length}))`;
  fs.writeFileSync(path.join(__dirname, 'snippets', `rot-apply-${key}.js`), code);
  console.log(key, D.length, code.length);
}
