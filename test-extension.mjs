import assert from 'node:assert/strict';
import { 后处理节点命名 } from './node-name-extension.js';

const cache = {
  '1.2.3.4:443': { ok: true, region: '中国香港', loc: 'HK', mbps: 43.2, ts: Date.now() },
  '5.6.7.8:443': { ok: true, region: '日本', loc: 'JP', mbps: 12.6, ts: Date.now() },
};
const env = { NODE_NAME_ENABLED: '1', KV: { get: async () => JSON.stringify(cache), put: async () => {} } };
const ctx = { waitUntil() {} };

const mixed = [
  'vless://00000000-0000-4000-8000-000000000000@1.2.3.4:443?security=tls#CF%E5%AE%98%E6%96%B9%E4%BC%98%E9%80%8926',
  'trojan://pass@5.6.7.8:443?sni=example.com#%E7%94%B5%E4%BF%A1%E4%BC%98%E9%80%89',
].join('\n');
const mixedOut = await 后处理节点命名(mixed, { env, ctx, 订阅类型: 'mixed' });
assert.match(mixedOut, /#%E4%B8%AD%E5%9B%BD%E9%A6%99%E6%B8%AF-43M$/m);
assert.match(mixedOut, /#%E6%97%A5%E6%9C%AC-13M$/m);
assert.match(mixedOut, /vless:\/\/00000000-0000-4000-8000-000000000000@1\.2\.3\.4:443\?security=tls#/);

const clash = `proxies:
  - {name: "CF官方优选26", type: vless, server: "1.2.3.4", port: 443, uuid: x}
  - name: '电信优选'
    type: trojan
    server: 5.6.7.8
    port: 443
proxy-groups:
  - name: 节点选择
    type: select
    proxies:
      - CF官方优选26
      - "电信优选"
`;
const clashOut = await 后处理节点命名(clash, { env, ctx, 订阅类型: 'clash' });
assert.match(clashOut, /name: "中国香港-43M"/);
assert.match(clashOut, /name: "日本-13M"/);
assert.match(clashOut, /- 中国香港-43M/);
assert.match(clashOut, /- "日本-13M"/);

const singbox = JSON.stringify({
  outbounds: [
    { type: 'vless', tag: 'CF官方优选26', server: '1.2.3.4', server_port: 443 },
    { type: 'selector', tag: '选择', outbounds: ['CF官方优选26'] },
  ],
});
const sbOut = await 后处理节点命名(singbox, { env, ctx, 订阅类型: 'singbox' });
assert.match(sbOut, /"tag":"中国香港-43M"/);
assert.match(sbOut, /"outbounds":\["中国香港-43M"\]/);

console.log('EXTENSION_TEST_OK');
