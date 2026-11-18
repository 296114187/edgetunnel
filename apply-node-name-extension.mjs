import fs from 'node:fs';

const file = new URL('./_worker.js', import.meta.url);
const revert = process.argv.includes('--revert');
let source = fs.readFileSync(file, 'utf8');

const importLine = "import { 后处理节点命名 } from './node-name-extension.js';\n";
// 兼容历史格式：注释行后用任意空白和空行直到 "});"，避免旧 hook 残留
const hookRe = /^\t*\/\/ 自定义扩展：在订阅内容输出前按节点地区\/网速重命名。[\s\S]*?^\t*\}\);\s*\n/m;

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

// 正确位置：占位符（example.com / 占位 UUID）替换之后，base64 编码与热补丁之前
const anchor = /^([ \t]*)if \(订阅类型 === 'mixed' && \(!ua\.includes\('mozilla'\)/m;

if (revert) {
  const before = source;
  source = source.replace(importLine, '').replace(hookRe, '');
  fs.writeFileSync(file, source);
  console.log(before === source ? '未发现需要撤销的接入点。' : '已从 _worker.js 移除节点命名扩展接入点。');
  process.exit(0);
}

// 先移除可能存在的旧接入点，保证位置正确且无重复
source = source.replace(hookRe, '');
if (source.includes('后处理节点命名')) throw new Error('检测到残留的扩展接入点，请先执行 --revert');

if (!source.includes(importLine)) {
  const match = source.match(/^(\uFEFF?)const Version /m);
  if (!match) throw new Error('未找到 const Version，无法插入 import');
  source = source.replace(match[0], `${match[1]}${importLine}const Version `);
}

const anchorMatch = source.match(anchor);
if (!anchorMatch) throw new Error('未找到订阅输出前锚点（占位符替换之后），无法插入扩展调用');
source = source.replace(anchor, `${hook(anchorMatch[1])}$&`);

fs.writeFileSync(file, source);
console.log('已将节点命名扩展接入点应用到 _worker.js（位于占位符替换之后）。');
