const e = require('../data/elements-L20.json').texts.filter(t => t.content === 'CAK-01CL');
console.log(JSON.stringify(e, null, 1));
console.log('pen json mtime', require('fs').statSync('./data/elements-L20.json').mtime.toISOString());
console.log('convert mtime ', require('fs').statSync('./scripts/convert.js').mtime.toISOString());
