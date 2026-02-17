# LiveResponse for Node.js & Express

This package brings **LiveResponse** to traditional Node.js and Express servers.

LiveResponse extends the HTTP request/response model with **persistent interactivity**. You send a response — and keep it open as a live communication channel.

Instead of closing after delivery, the response becomes interactive.

For the full conceptual model, see the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#section-1-liveresponse).

If you’re building a system where live interactivity is a first-class architectural primitive, use **[Webflo](https://github.com/webqit/webflo)**. Live responses are native there.
This package exists for cases where you want LiveResponse inside an otherwise conventional Node.js or Express backend.

---

## Installation

```bash
npm install @webqit/node-live-response
```

---

## One-Time Setup

The first thing you do is enable live mode on your HTTP server instance. This installs the transport layer and request bookkeeping required for live sessions.

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

The returned `liveMode` function enables live mode per route.

It works both as:

* a direct function (Node HTTP)
* an Express middleware

### Node.js HTTP server

```js
async function handler(req, res) {
    liveMode(req, res);

    const liveRes = new LiveResponse('Hello world');
    await res.send(liveRes); // resolves when the live connection is established

    // ---- interactive phase ----

    setTimeout(() => {
        res.die(); // explicitly end live mode
    }, 5000);
}
```

### Express

```js
app.get('/counter', liveMode(), async (req, res) => {
    const liveRes = new LiveResponse('Hello world');
    await res.send(liveRes); // resolves when the live connection is established
    
    // ---- interactive phase ----
    
    setTimeout(() => {
        res.die();
    }, 5000);
});
```

---

## Interaction Patterns

LiveResponse supports three core interaction patterns.

---

### 1. Live state projection

Send a mutable object as the response body.

Mutations on the server automatically propagate to the client.

(More in the [LiveResponse docs](https://github.com/webqit/fetch-plus#1-live-state-projection-via-mutable-response-bodies))

On the server:

```js
import { Observer } from '@webqit/observer';

app.get('/counter', liveMode(), async (req, res) => {
    const state = { count: 0 };

    const liveRes = new LiveResponse(state);
    await res.send(liveRes);

    const interval = setInterval(() => {
        Observer.set(state, 'count', state.count + 1);
    }, 1_000);

    setTimeout(() => {
        clearInterval(interval);
        res.die();
    }, 60_000);
});
```

On the client:

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

> [!TIP]
> This example can be previewed live by running:
>
> ```
> cd node-live-response
> node test/server1.js
> ```
> _Open localhost:3000 to view_

---

### 2. Response swapping

Replace the current response with a new one — without issuing a new HTTP request.

This enables a multi-response architecture over a single request.

(More in the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#2-a-multi-response-architecture-via-response-swaps))

On the server:

```js
app.get('/news', liveMode(), async (req, res) => {
    const liveRes = new LiveResponse(
        { headline: 'Breaking: Hello World' },
        { done: false }
    );

    await res.send(liveRes);

    setTimeout(() => {
        liveRes.replaceWith(
            { headline: 'Update: Still Hello World' },
            { done: false }
        );
    }, 3_000);

    setTimeout(() => {
        liveRes.replaceWith({ headline: 'Final: Goodbye' });
    }, 6_000);

    setTimeout(() => {
        res.die();
    }, 60_000);
});
```

On the client:

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
    liveRes.addEventListener('replace', (e) => {
        document.querySelector('h1').textContent = e.data.body.headline;
    });
  </script>
</body>
```

> [!TIP]
> This example can be previewed live by running:
>
> ```
> cd node-live-response
> node test/server2.js
> ```
> _Open localhost:3000 to view_

---

### 3. Bidirectional messaging

Exchange messages between client and server through a message port.

(More in the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#3-bidirectional-messaging-via-message-ports))

On the server:

```js
app.get('/chat', liveMode(), async (req, res) => {
    const liveRes = new LiveResponse({ title: 'Chat' });
    await res.send(liveRes);

    req.port.addEventListener('message', (e) => {
        req.port.postMessage(e.data);
    });

    setTimeout(() => {
        res.die();
    }, 60_000);
});
```

On the client:

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
    
    const { port } = await LiveResponse.from(fetch('/chat')).now();
    port.addEventListener('message', (e) => {
        const li = document.createElement('li');
        li.textContent = e.data;
        log.appendChild(li);
    });

    const msg = document.querySelector('#msg');
    msg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            port.postMessage(msg.value);
            msg.value = '';
        }
    });
  </script>
</body>
```

> [!TIP]
> This example can be previewed live by running:
>
> ```
> cd node-live-response
> node test/server3.js
> ```
> _Open localhost:3000 to view_

---

## What This Library Adds

`@webqit/node-live-response` augments the standard Node/Express request lifecycle:

* Adds `req.port` for bidirectional messaging
* Adds `req.signal` for live session lifecycle tracking
* Patches `res.send()` / `res.end()` to accept `LiveResponse`
* Adds `res.die()` to explicitly terminate live interaction

---

## Lifecycle Contract

Live interaction has its own lifecycle, separate from the HTTP lifecycle.

### Interactivity starts

Interactivity begins when you send a `LiveResponse`:

```js
await res.send(liveRes);
```

That is the moment the client learns that the response is interactive and joins the live channel.

The `send()` method, this time, returns promise that resolves when the client has joined the live channel.

You may await this promise where necessary, but messages or response swaps issued before the connection is fully established are automatically queued and flushed once live mode becomes active.

The transition to an "open" connection may also be observed via:

```js
await req.port.readyStateChange('open');
```

---

### Interactivity ends

Live interaction ends when the LiveResponse port on the client side is closed or when you explicitly call:

```js
res.die();
```

on the server. This method aborts the request lifecycle signal exposed at `req.signal`.

Note that ending the HTTP response does **not** end the live session.

The HTTP lifecycle and the live lifecycle are independent.

The transition to a "closed" connection may be observed via:

```js
await req.port.readyStateChange('close');
```

---

## Learn More

* [LiveResponse docs](https://github.com/webqit/fetch-plus#1-live-state-projection-via-mutable-response-bodies)
* [Webflo](https://github.com/webqit/webflo)

---

## License

MIT
