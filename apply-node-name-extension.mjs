import fs from 'node:fs';

const file = new URL('./_worker.js', import.meta.url);
const revert = process.argv.includes('--revert');
let source = fs.readFileSync(file, 'utf8');

const importLine = "import { 后处理节点命名 } from './node-name-extension.js';\n";
const hookStart = '\t\t\t\t\t\t// 自定义扩展：在订阅内容输出前按节点地区/网速重命名。';

const hook = (indent) => [
  `${indent}// 自定义扩展：在订阅内容输出前按节点地区/网速重命名。由 NODE_NAME_ENABLED 控制，默认关闭；扩展内部失败不会影响原订阅。`,
  `${indent}订阅内容 = await 后处理节点命名(订阅内容, {`,
  `${indent}\tenv, request, ctx, log, 订阅类型,`,
  `${indent}\t创建请求TCP连接器,`,
  `${indent}\tTlsClient,`,
  `${indent}\t拼接字节数据,`,
  `${indent}\ttextEncoder,`,
  `${indent}\ttextDecoder,`,
  `${indent}});`,
  '',
].join('\n');

if (revert) {
  source = source.replace(importLine, '');
  source = source.replace(/^\t{6}\/\/ 自定义扩展：在订阅内容输出前按节点地区\/网速重命名。[\s\S]*?^\t{6}\}\);\n\n/m, '');
  fs.writeFileSync(file, source);
  console.log('已从 _worker.js 移除节点命名扩展接入点。');
  process.exit(0);
}

if (source.includes('后处理节点命名')) {
  console.log('节点命名扩展接入点已存在，无需重复应用。');
  process.exit(0);
}

if (!source.includes(importLine)) {
  const match = source.match(/^(\uFEFF?)const Version /m);
  if (!match) throw new Error('未找到 const Version，无法插入 import');
  source = source.replace(match[0], `${match[1]}${importLine}const Version `);
}

const anchor = /^(\s*)if \(!ua\.includes\('subconverter'\) && 用户客户端请求订阅\) \{/m;
const anchorMatch = source.match(anchor);
if (!anchorMatch) throw new Error('未找到订阅输出前锚点，无法插入扩展调用');
source = source.replace(anchor, `${hook(anchorMatch[1])}$&`);

fs.writeFileSync(file, source);
console.log('已将节点命名扩展接入点应用到 _worker.js。');
