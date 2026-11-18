import { 后处理节点命名 } from './node-name-extension.js';

const node = 'vless://u@1.2.3.4:443?security=tls#US';
const KV = {
  _d: {},
  async get(k) { return this._d[k] ?? null; },
  async put(k, v) { this._d[k] = v; },
};
const out = await 后处理节点命名(node, {
  env: { NODE_NAME_ENABLED: '1', KV, NODE_NAME_MAX_TESTS: '2' },
  request: { url: 'https://example.com/sub?token=x&namediag=1' },
  订阅类型: 'mixed',
  log: () => {},
  ctx: { waitUntil() {} },
  // 模拟连接器失败（订阅请求里 request.fetcher 不可用的情况）
  创建请求TCP连接器: () => { throw new Error('request.fetcher.connect unavailable'); },
});
console.log(out.split('\n').slice(0, 10).join('\n'));
if (!out.includes('节点命名诊断') || !out.includes('request.fetcher')) {
  console.error('DIAG_TEST_FAIL');
  process.exit(1);
}
console.log('DIAG_TEST_OK');
