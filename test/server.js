import { enableLive } from '../src/index.js';
import { LiveResponse } from '@webqit/fetch-plus';

const server = http.createServer((req, res) => {
    live(req, res);
    res.send(new LiveResponse('Hello world'));
});

const live = enableLive(server);
server.listen(3000);
