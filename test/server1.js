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
    if (req.url !== '/counter') {
        return fs.createReadStream('./test/index1.html').pipe(res);
    }
    liveMode(req, res);
    // --------------------------

    const state = { count: 0 };

    const liveRes = new LiveResponse(state);
    await res.send(liveRes); // resolves when live mode is established

    const interval = setInterval(() => {
        console.log('_________________________', state.count);
        Observer.set(state, 'count', state.count + 1);
    }, 1_000);

    setTimeout(() => {
        clearInterval(interval);
        res.die();
    }, 60_000);
}