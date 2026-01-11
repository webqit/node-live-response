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
    if (req.url !== '/news') {
        return fs.createReadStream('./test/index2.html').pipe(res);
    }
    liveMode(req, res);
    // --------------------------

    const liveRes = new LiveResponse({ headline: 'Breaking: Hello World' }, { done: false });
    await res.send(liveRes); // resolves when live mode is established

    setTimeout(() => {
        liveRes.replaceWith({ headline: 'Update: Still Hello World' }, { done: false });
    }, 3_000);

    setTimeout(() => {
        liveRes.replaceWith({ headline: 'Final: Goodbye' });
    }, 6_000);

    setTimeout(() => {
        res.die();
    }, 60_000);
}