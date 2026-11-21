// Recomputes the Content-Security-Policy hash for the single inline <script> in index.html.
// Run after any script edit: node tests/update-csp.cjs
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(__dirname,'../index.html'),html=fs.readFileSync(file,'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const hash=crypto.createHash('sha256').update(script,'utf8').digest('base64');
const next=html.replace(/script-src 'sha256-[^']+'/,`script-src 'sha256-${hash}'`);
if(next===html&&!html.includes(`'sha256-${hash}'`))throw Error('CSP meta tag with script-src hash not found');
fs.writeFileSync(file,next);console.log('script-src sha256-'+hash);
