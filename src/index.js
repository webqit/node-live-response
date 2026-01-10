import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { StarPort, WebSocketPort } from '@webqit/port-plus';
import { LiveResponse, Observer } from '@webqit/fetch-plus';

export { LiveResponse, Observer }

export function enableLive(server) {
    // One-time WS setup
    handleUpgrade(server);

    function live(req, res, next) {
        // Node-style usage: live(req, res)
        if (req && res) {
            setupLiveRoute(req, res);
            return;
        }

        // Express-style usage: live()
        return (req, res, next) => {
            setupLiveRoute(req, res);
            next();
        };
    }

    return live;
}

export const portRegistry = new Map();

export function setupLiveRoute(req, res) {
    const port = new StarPort();
    const portId = crypto.randomUUID();

    portRegistry.set(portId, port);

    const abortController = new AbortController();
    let hasLiveResponse = false;

    const die = () => {
        if (abortController.signal.aborted) return;
        abortController.abort();
        port.close();
        portRegistry.delete(portId);
    };

    // ---- request-scoped capabilities ----
    req.port = port;
    req.signal = abortController.signal;

    // ---- response-scoped lifecycle ----
    res.die = die;

    const originalSend = res.send?.bind(res);
    const originalEnd = res.end.bind(res);

    async function commitLiveResponse(liveResponse) {
        if (hasLiveResponse) return;
        hasLiveResponse = true;

        const response = liveResponse.toResponse({
            port,
            signal: abortController.signal,
        });

        response.headers.set(
            'X-Message-Port',
            `socket:///?port_id=${portId}`
        );

        for (const [name, value] of response.headers) {
            res.setHeader(name, value);
        }

        if (response.body) {
            await response.body.pipeTo(
                new WritableStream({
                    write(chunk) {
                        res.write(chunk);
                    },
                    close() {
                        res.end();
                    },
                    abort(err) {
                        res.destroy(err);
                    },
                })
            );
        } else {
            res.end();
        }
    }

    // ---- intercept Express-style response exits ----
    if (originalSend) {
        res.send = (value) => {
            if (value instanceof LiveResponse) {
                commitLiveResponse(value);
                return req.port.readyStateChange('open').then(() => res);
            }
            return originalSend(value);
        };
    }

    res.end = (...args) => {
        // Only end live mode if no LiveResponse was ever committed
        if (!hasLiveResponse) {
            die();
        }
        return originalEnd(...args);
    };
}

export function handleUpgrade(server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const portId = url.searchParams.get('port_id');

        if (!portId || !portRegistry.has(portId)) {
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            const wsPort = new WebSocketPort(ws);
            portRegistry.get(portId).addPort(wsPort);
        });
    });
}

