import assert from 'node:assert/strict';
import { 后处理节点命名 } from './node-name-extension.js';

const now = Date.now();
// 三个不同地址，两个同名 US，一个 SG；模拟真实订阅里大量重名的情况
const cache = {
  '192.210.196.158:36414': { ok: true, region: '美国', loc: 'US', mbps: 43.2, ts: now },
  '107.174.152.237:9443': { ok: true, region: '日本', loc: 'JP', mbps: 12.6, ts: now },
  '13.213.65.117:443': { ok: true, region: '新加坡', loc: 'SG', mbps: 88.4, ts: now },
};
const env = { NODE_NAME_ENABLED: '1', KV: { get: async () => JSON.stringify(cache), put: async () => {} } };
const ctx = { waitUntil() {} };

// 浏览器直连拿到的是明文 mixed（含重名 #US）
const mixed = [
  'vless://u@192.210.196.158:36414?security=tls&type=ws#US',
  'vless://u@107.174.152.237:9443?security=tls&type=ws#US',
  'vless://u@13.213.65.117:443?security=tls&type=ws#SG',
].join('\n');
const out = await 后处理节点命名(mixed, { env, ctx, 订阅类型: 'mixed' });
console.log(out);
assert.match(out, /192\.210\.196\.158:36414[^#]*#%E7%BE%8E%E5%9B%BD-43M$/m);
assert.match(out, /107\.174\.152\.237:9443[^#]*#%E6%97%A5%E6%9C%AC-13M$/m);
assert.match(out, /13\.213\.65\.117:443[^#]*#%E6%96%B0%E5%8A%A0%E5%9D%A1-88M$/m);

// 两个 US 变成了不同名字，说明按地址改名生效
const lines = out.split('\n');
assert.notEqual(lines[0].split('#')[1], lines[1].split('#')[1]);

console.log('REAL_SUB_TEST_OK');
