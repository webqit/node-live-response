# LiveResponse for Node.js & Express

This package brings **LiveResponse** to traditional Node.js and Express backends.

LiveResponse is a new response model that extends the HTTP request/response model with interactivity. It allows you to send a response and keep it open for interaction. You want to see the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#section-1-liveresponse) for more details.

The definitive way to get full, always‑on interactivity as a core architectural primitive is **[Webflo](https://github.com/webqit/webflo)**. Live responses are native and automatic there. This package exists for cases where you want LiveResponse inside an otherwise conventional Node.js or Express backend.

---

## Installation

```bash
npm install @webqit/node-live-response
```

---

## One-Time Setup

The first thing you do is enable live mode against your server instance. This sets up the transport and request bookkeeping required for LiveResponse.

### Node.js HTTP server

```js
import http from 'http';
import { enableLive } from '@webqit/node-live-response';

const server = http.createServer(handler);
const liveMode = enableLive(server);

server.listen(3000);
```

### Express

```js
import express from 'express';
import { enableLive } from '@webqit/node-live-response';

const app = express();
const server = app.listen(3000);

const liveMode = enableLive(server);
```

---

## Usage

The returned `liveMode` function is your per-route live mode switch. Call it on a route where you want live mode enabled.

This function works as both a direct function and an Express middleware.

### Node.js HTTP server

```js
async function handler(req, res) {
    liveMode(req, res);

    const liveRes = new LiveResponse('Hello world');
    await res.send(liveRes); // resolves when live mode is established

    // ------- interactive phase -------

    setTimeout(() => {
        res.die();
    }, 5000);
}
```

### Express

```js
app.get('/counter', liveMode(), async (req, res) => {
    const liveRes = new LiveResponse('Hello world');
    await res.send(liveRes); // resolves when live mode is established
    
    // ------- interactive phase -------
    
    setTimeout(() => {
        res.die();
    }, 5000);
});
```

---

## Live interaction patterns

LiveResponse supports three core interaction patterns.

### 1. Live state projection

A live object can be sent as the response body.

Mutating that object on the server automatically reflects on the client. (More in the [LiveResponse docs](https://github.com/webqit/fetch-plus#1-live-state-projection-via-mutable-response-bodies))

```js
import { Observer } from '@webqit/observer';

app.get('/counter', liveMode(), async (req, res) => {
    const state = { count: 0 };

    const liveRes = new LiveResponse(state);
    await res.send(liveRes); // resolves when live mode is established

    const interval = setInterval(() => {
        Observer.set(state, 'count', state.count + 1);
    }, 1000);

    setTimeout(() => {
        clearInterval(interval);
        res.die();
    }, 10000);
});
```

Then on the client:

```html
<!doctype html>
<head>
  <title>Live Counter</title>
  <script src="https://unpkg.com/@webqit/fetch-plus/dist/main.js"></script>
</head>
<body>

  <h1></h1>
  
  <script type="module">
    const { LiveResponse, Observer } = window.webqit;
    
    const { body: state } = await LiveResponse.from(fetch('/counter')).now();

    Observer.observe(state, () => {
        document.querySelector('h1').textContent = 'Count: ' + state.count;
    });
  </script>
</body>
</html>
```

### 2. Response swapping

A live response can be replaced with a new one – without opening a new request. It gives you a multi-response architecture. (More in the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#2-a-multi-response-architecture-via-response-swaps))

```js
app.get('/news', liveMode(), async (req, res) => {
    const liveRes = new LiveResponse({ headline: 'Breaking: Hello World' });
    await res.send(liveRes); // resolves when live mode is established

    setTimeout(() => {
        liveRes.replaceWith({ headline: 'Update: Still Hello World' });
    }, 3000);

    setTimeout(() => {
        liveRes.replaceWith({ headline: 'Final: Goodbye' });
        res.die();
    }, 6000);
});
```

Then on the client:

```html
<!doctype html>
<head>
  <title>Live News</title>
  <script src="https://unpkg.com/@webqit/fetch-plus/dist/main.js"></script>
</head>
<body>
  <h1></h1>
  <script type="module">
    const { LiveResponse } = window.webqit;
    
    const liveRes = LiveResponse.from(fetch('/news'));
    liveRes.addEventListener('response', (e) => {
        document.querySelector('h1').textContent = e.body.headline;
    });
  </script>
</body>
```

### 3. Bidirectional messaging

Live responses can exchange messages bidirectionally. (More in the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#3-bidirectional-messaging-via-message-ports))

```js
app.get('/chat', liveMode(), async (req, res) => {
    const liveRes = new LiveResponse({ title: 'Chat' });
    await res.send(liveRes); // resolves when live mode is established

    req.port.addEventListener('message', (e) => {
        req.port.postMessage(e.data);
    });
});
```

Then on the client:

```html
<!doctype html>
<head>
  <title>Live Chat</title>
  <script src="https://unpkg.com/@webqit/fetch-plus/dist/main.js"></script>
</head>
<body>

  <h1>Chat</h1>
  <ul id="log"></ul>
  <input id="msg" placeholder="Type and press enter" />

  <script type="module">
    const { LiveResponse } = window.webqit;
    
    const liveRes = LiveResponse.from(fetch('/chat'));
    liveRes.port.addEventListener('message', (e) => {
        const li = document.createElement('li');
        li.textContent = e.data;
        log.appendChild(li);
    });

    const msg = document.querySelector('#msg');
    msg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            liveRes.port.postMessage(msg.value);
            msg.value = '';
        }
    });
  </script>
</body>
```

---

## What `node-live-response` does

The library:

* attaches `req.port` and `req.signal` to the request object.
* patches `res.send()` / `res.end()` to accept `LiveResponse`. Note that calling res.send() with a LiveResponse gives you back a promise that resolves when the connection is live. This promise is to be awaited before interacting with the live response.
* adds `res.die()` to the response object. This must be called to end interactivity.

---

## Lifecycle contract

### When interactivity starts

Interactivity begins **after** the server sends a `LiveResponse`:

```js
res.send(liveRes);
```

That is the moment the client learns that the response is interactive and joins the live channel.

* Live state projection and `replaceWith()` are only meaningful *after* this moment
* Messages sent on `req.port` *before* this moment are queued

(Contrast this with Webflo, where interaction is implicit and automatic.)

### When interactivity ends

Live mode ends only when you explicitly call `res.die()`. This must be called to end interactivity:

```js
res.die();
```

Ending the HTTP response does **not** end live interaction. The request lifecycle and the live lifecycle are not coupled.

---

## Learn more

* [LiveResponse docs](https://github.com/webqit/fetch-plus#1-live-state-projection-via-mutable-response-bodies)
* [Webflo](https://github.com/webqit/webflo)

---

## License

MIT
