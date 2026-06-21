// Helper: set/clear mobile device metrics on a CDP page target via raw protocol.
// Compensates for bb-browser 0.14.2 lacking a viewport/emulate command.
const WS = require(require('child_process').execSync('npm root -g').toString().trim() + '/bb-browser/node_modules/ws');
const url = process.argv[2];
const mode = process.argv[3] || 'set'; // set | clear
const ws = new WS(url);
let id = 0;
const pending = {};
function send(method, params) {
  return new Promise((res) => { const i = ++id; pending[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
}
ws.on('message', (m) => { const o = JSON.parse(m); if (o.id && pending[o.id]) { pending[o.id](o); delete pending[o.id]; } });
ws.on('open', async () => {
  if (mode === 'clear') {
    await send('Emulation.clearDeviceMetricsOverride', {});
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    console.log('cleared');
  } else {
    const r = await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    console.log('set 390x844 ->', JSON.stringify(r.result || r.error || {}));
  }
  ws.close();
});
ws.on('error', (e) => { console.error('WSERR', e.message); process.exit(1); });
