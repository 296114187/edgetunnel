import fs from 'node:fs';

// 将 node-name-extension.js 内联进 _worker.js，生成"单文件"版本。
// 原因：Cloudflare Pages 直接上传 ZIP 时不解析 _worker.js 里的相对 import，
// 会报 Unable to resolve import './node-name-extension.js'。内联后两种部署方式都可用。
//
// 用法：
//   node apply-node-name-extension.mjs          应用
//   node apply-node-name-extension.mjs --revert 撤销，恢复为上游原版
//
// 上游同步：用原作者的新 _worker.js 覆盖本目录文件后，重跑本脚本即可。

const file = new URL('./_worker.js', import.meta.url);
const extFile = new URL('./node-name-extension.js', import.meta.url);
const revert = process.argv.includes('--revert');
let source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');

const MARK_BEGIN = '/* ==== 节点命名扩展 BEGIN (内联, apply-node-name-extension.mjs 生成, 请勿手改) ==== */';
const MARK_END = '/* ==== 节点命名扩展 END ==== */';
const OLD_IMPORT = "import { 后处理节点命名 } from './node-name-extension.js';";

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
// 正确锚点：占位符（example.com / 占位 UUID）替换之后、base64 编码之前
const anchor = /^([ \t]*)if \(订阅类型 === 'mixed' && \(!ua\.includes\('mozilla'\)/m;

function stripExtension(src) {
  const begin = src.indexOf(MARK_BEGIN);
  const end = src.indexOf(MARK_END);
  if (begin !== -1 && end !== -1 && end > begin) src = src.slice(0, begin) + src.slice(end + MARK_END.length);
  src = src.replace(OLD_IMPORT + '\n', '').replace(OLD_IMPORT, '');
  return src.replace(hookRe, '').replace(/^\n+/, '');
}

if (revert) {
  const before = source;
  source = stripExtension(source);
  fs.writeFileSync(file, source);
  console.log(before === source ? '未发现需要撤销的扩展。' : '已移除内联扩展与接入点，_worker.js 恢复为上游原版。');
  process.exit(0);
}

// 先剥离已有扩展，保证可重复执行、无残留
source = stripExtension(source);

const extSource = fs.readFileSync(extFile, 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/^export\s+async\s+function/m, 'async function')
  .replace(/^export\s+/gm, '')
  .trim();

// 1) 文件顶部插入内联扩展块
// 关键：用 IIFE 包裹，让扩展的 31 个顶层符号全部局部化，避免与 _worker.js
// 已有的同名符号（如 缓存键、解析地址端口）冲突；只向外暴露一个函数。
const inlinedBlock = [
  MARK_BEGIN,
  'const { 后处理节点命名 } = (() => {',
  extSource,
  '\treturn { 后处理节点命名 };',
  '})();',
  MARK_END,
  '',
].join('\n');
source = inlinedBlock + source;

// 2) 正确位置插入调用点
const anchorMatch = source.match(anchor);
if (!anchorMatch) throw new Error('未找到订阅输出前锚点（占位符替换之后），无法插入扩展调用');
source = source.replace(anchor, `${hook(anchorMatch[1])}$&`);

fs.writeFileSync(file, source);
const calls = (source.match(/await 后处理节点命名\(订阅内容/g) || []).length;
console.log(`已内联扩展 (${extSource.length} 字节)，调用点 ${calls} 处。当前为单文件版本，可直接上传 ZIP 或 Git 部署。`);
if (calls !== 1) console.warn('警告：调用点数量异常，请检查。');
