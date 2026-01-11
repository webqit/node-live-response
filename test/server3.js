import http from 'http';
import fs from 'fs';
import { enableLive, Observer } from '../src/index.js';
import { LiveResponse } from '@webqit/fetch-plus';

const server = http.createServer(handler);
const liveMode = enableLive(server);

server.listen(3000);
console.log('Server started on port 3000');

// ------------

async function handler(req, res) {
    // --------------------------
    if (req.url !== '/chat') {
        return fs.createReadStream('./test/index3.html').pipe(res);
    }
    liveMode(req, res);
    // --------------------------

    const liveRes = new LiveResponse({ title: 'Chat' });
    await res.send(liveRes); // resolves when live mode is established

    req.port.addEventListener('message', (e) => {
        req.port.postMessage(e.data);
    });

    setTimeout(() => {
        res.die();
    }, 60_000);
}