# LiveResponse for Node.js & Express

> **Realtime applications in just a single primitive**

This package brings **LiveResponse** to traditional Node.js and Express backends.

**LiveResponse** extends the *stateless* HTTP request/response model with **stateful, updatable, and interactive responses** for realtime applications.

A "live" response is an HTTP response that can be updated, replaced, and interacted with after it is sent.

For example, you can send a response on the server and mutate it in-place as you progressively process the request:

```js
app.get('/counter', liveMode, async (req, res) => {
    const state = { count: 0 };

    await res.send(new LiveResponse(state));

    setInterval(() => {
        Observer.set(state, 'count', state.count + 1);
    }, 1000);
});
```

On receiving the response, the client can observe those changes in real time:

```html
<script type="module">
  const { body: state } = await LiveResponse.from(fetch('/counter')).now();

  console.log('Initial:', state.count);

  Observer.observe(state, () => {
    console.log('Current:', state.count);
  });
</script>
```

Above:

+ [`Observer`](https://github.com/webqit/observer) helps make mutations on the ordinary object reactive and observable.
+ `LiveResponse` carries the object as live state through the wire–keeping it synchronized with the client. (**LiveResponse** lets the host runtime decide the underlying update path. e.g. WebSocket)
+ `@webqit/node-live-response` itself–the host runtime–establishes a WebSocket channel under the hood for the update path.

The model broadens into various shapes of realtime applications–**built out of just a single primitive**.

---

## The Model

HTTP is a **stateless** protocol; traditional responses are **immutable snapshots**. Realtime apps have to split communication into two parts:

+ the conventional HTTP request/response model
+ a separate real-time channel (WebSocket, SSE) for updates

This split introduces coordination overhead — two lifecycles, two APIs, and complex state engineering.

**LiveResponse** removes this split by **making the response itself stateful–updatable, replaceable, and interactive**.

**LiveResponse** is the full traditional real-time stack merged back into the existing request/response model.

---

## Context

**"Live Response"** is a new response model over the existing HTTP request/response model.

It is being developed at **[WebQit](https://github.com/webqit)** for a new class of applications and agentic workflows.

The core primitive `LiveResponse` is fully documented in the [LiveResponse README](https://github.com/webqit/fetch-plus?tab=readme-ov-file#section-1-liveresponse) along with a detailed conceptual model.

If you’re building a system that is state-sensitive or highly interaction, use the **[Webflo](https://github.com/webqit/webflo)** framework. Live responses are native there. This package exists for the barest minimal **LiveResponse** implementations.

---

## Installation

```bash
npm install @webqit/node-live-response
```

---

## One-Time Setup

The first thing you do is enable live mode on your HTTP server instance. This sets up the transport layer and request bookkeeping required for live sessions.

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

> Note that as shown above `enableLive` needs the HTTP Server instance itself, not the Express `app` object.

---

## Usage

The returned `liveMode` function is used per-route to opt a route into live mode.

It works both as:

* a direct callable function
* an Express middleware

### Node.js HTTP server

```js
async function handler(req, res) {
    liveMode(req, res);

    const liveRes = new LiveResponse('Hello world');
    await res.send(liveRes); // resolves when the client receives the response and joins the live connection

    // ---- response remains open for interactive after send()  ----
    // ---- mutate, replace, or interact with the response here ----
    // ---- call res.die() to explicitly end live mode          ----

    setTimeout(() => {
        res.die();
    }, 5000);
}
```

### Express

```js
app.get('/counter', liveMode, async (req, res) => {
    const liveRes = new LiveResponse('Hello world');
    await res.send(liveRes); // resolves when the client receives the response and joins the live connection

    // ---- response remains open for interactive after send()  ----
    // ---- mutate, replace, or interact with the response here ----
    // ---- call res.die() to explicitly end live mode          ----

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

Mutations on the server automatically apply to the client-side copy.

(More in the [LiveResponse docs](https://github.com/webqit/fetch-plus#1-live-state-projection-via-mutable-response-bodies))

On the server:

```js
import { Observer } from '@webqit/observer';

app.get('/counter', liveMode, async (req, res) => {
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

Above, `await LiveResponse.from(fetch('/counter')).now()` takes a `fetch` call and gives you back the HTTP response as a parsed object. But `LiveResponse` does more under the hood:

+ Detects that the response is a live response
+ Automatically joins the live channel created on the server
+ Keeps remote state and local state in sync

> [!TIP]
> This example can be previewed in the **[WebQit Playground](https://github.com/webqit/playground)**.

---

### 2. Response swapping

Replace the current response with a new one — without issuing a new HTTP request.

This gives you a multi-response model over a single request.

(More in the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#2-a-multi-response-architecture-via-response-swaps))

On the server:

```js
app.get('/news', liveMode, async (req, res) => {
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

Above, `LiveResponse.from(fetch('/news'))` takes a `fetch` call and gives you back a `LiveResponse` interface over the ongoing HTTP request. It is on this interface you do `.addEventListener('replace')`.

Meanwhile, under the hood `LiveResponse` does:

+ Detects that the response is a live response
+ Automatically joins the live channel created on the server
+ Keeps remote state and local state in sync–while exposing response swaps as `'replace'` events

> [!TIP]
> This example can be previewed in the **[WebQit Playground](https://github.com/webqit/playground)**.

---

### 3. Bidirectional messaging

Exchange messages between client and server through a message port.

(More in the [LiveResponse docs](https://github.com/webqit/fetch-plus?tab=readme-ov-file#3-bidirectional-messaging-via-message-ports))

On the server:

```js
app.get('/chat', liveMode, async (req, res) => {
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

Above, `await LiveResponse.from(fetch('/counter')).now()` takes a `fetch` call and gives you back the HTTP response as a parsed object. The returned object always includes the underlying communication port (`port`) that powers the live response session. It is on this `port` you do `.addEventListener('message')`.

As before, under the hood `LiveResponse` does:

+ Detects that the response is a live response
+ Automatically joins the live channel created on the server
+ Keeps remote state and local state in sync–while exposing the underlying channel (`port`) for bidirectional messaging

> [!TIP]
> This example can be previewed in the **[WebQit Playground](https://github.com/webqit/playground)**.

---

## About `@webqit/node-live-response` Itself

`@webqit/node-live-response` augments the standard Node/Express request lifecycle:

* Introduces `req.port` for bidirectional messaging
* Introduces `req.signal` for tracking live session lifecycles
* Patches `res.send()` / `res.end()` to accept `LiveResponse`
* Introduces `res.die()` to explicitly terminate live interaction

---

## Lifecycle Behaviours

Live responses have their own lifecycle.

### When interactivity starts

Interactivity begins when you send a `LiveResponse` and the client has received it:

```js
await res.send(liveRes);
```

That is the moment the client learns that the response is interactive and joins the live channel.

The `send()` method, returns a promise that resolves when the client joins the live channel.

> [!TIP]
> You may await this promise where necessary–e.g. you want the client to already receive the response and join the live channel before your next update. In the general case, awaiting this promise is often not necessary. Messages or response swaps issued before the client joins are automatically queued and flushed when the client joins.

In addition to `send()` resolving, `req.port` also transitions to an "open" state when the client joins. That transition is observable:

```js
await req.port.readyStateChange('open');
```

---

### When interactivity ends

Live interaction ends when the LiveResponse port on the client side is closed or when you explicitly call:

```js
res.die();
```

on the server.

> This method also aborts the request lifecycle signal exposed at `req.signal`.

On termination, `req.port` transitions to an "closed" state. That transition is also observable:

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
