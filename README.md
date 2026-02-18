# Easy Signal

Two types of signals for reactive programming. **Event signals** are functions for listening to and emitting events.
**Store signals** are reactive data containers that track changes and automatically update dependents, similar to
Solid.js signals.

Full type safety with TypeScript for both.

## Installation

```
npm install easy-signal
```

## Signal Usage

A Signal is a function that represents a single event. Call it with a function to subscribe. Use `.emit()` to dispatch.

Unlike the browser's `EventTarget` API where all events share a generic `Event` object, each signal has its own typed
signature. This makes signals excellent for TypeScript — you can see exactly what data each event produces.

### Basic Usage

```ts
// file seconds.ts
import { signal } from 'easy-signal';

// Create the signal with a typed subscriber signature
export const onSecond = signal<(seconds: number) => void>();

setInterval(() => {
  const currentSecond = Math.floor(Date.now() / 1000);
  onSecond.emit(currentSecond);
}, 1000);
```

```ts
import { onSecond } from './seconds';

// TypeScript knows that seconds is a number
const unsubscribe = onSecond(seconds => {
  console.log(seconds, 'since epoch');
});
```

### Error Handling

Subscribe to errors separately and emit them with `.emitError()`:

```ts
import { signal } from 'easy-signal';

const dataStream = signal<(data: any) => void>();

dataStream(data => console.log('data:', data));
dataStream.error(error => console.log('error:', error));

stream.on('data', obj => dataStream.emit(obj));
stream.on('error', err => dataStream.emitError(err));
```

### Clearing Subscribers

```ts
import { signal } from 'easy-signal';

const onSomething = signal();

onSomething.clear(); // removes all subscribers and error listeners
```

## Store Usage

A store is a reactive container for a single value. Read and write with `.state`, subscribe to changes with
`.subscribe()`, and use `computed()` and `watch()` for automatic dependency tracking.

### Basic Usage

```ts
// file seconds.ts
import { store } from 'easy-signal';

export const seconds = store(0);

setInterval(() => {
  seconds.state = Math.floor(Date.now() / 1000);
}, 1000);
```

```ts
import { seconds } from './seconds';

// Read the value at any time
console.log(seconds.state, 'since epoch');

// Subscribe to changes (calls immediately with the current value, then on every change)
const unsubscribe = seconds.subscribe(value => {
  console.log(value, 'since epoch');
});

// Pass false to skip the initial call and only listen for future changes
seconds.subscribe(value => {
  console.log('changed to', value);
}, false);
```

### `readonly` Stores

Create a store that exposes only the `.state` getter and `.subscribe()`, hiding the setter. Useful for encapsulating
stores where the value is set internally via a `start` notifier.

```ts
import { readonly } from 'easy-signal';

const time = readonly<number>(undefined, set => {
  const id = setInterval(() => set(Date.now()), 1000);
  return () => clearInterval(id);
});

console.log(time.state); // current time, updated every second
```

### `watch`

Run a function whenever any store accessed within it changes. Dependencies are tracked automatically.

```ts
import { store, watch, onAnimationFrame } from 'easy-signal';

const user = store(userData);
const billing = store(billingData);

const updateDom = onAnimationFrame((name: string, plan: string) => {
  document.body.innerText = `${name} has the plan ${plan}`;
});

const unwatch = watch(() => {
  updateDom(user.state.name, billing.state.plan);
});
```

### `computed`

Create a read-only store whose value is computed from other stores. Re-runs automatically when dependencies change.

```ts
import { computed } from 'easy-signal';
import { user, billing } from './my-stores';

const delinquent = computed(() => {
  if (user.state.subscribed) {
    return billing.state.status === 'delinquent';
  }
  return false;
});

delinquent.subscribe(value => {
  console.log(`The user is${value ? '' : ' not'} delinquent`);
});
```

### `batch`

Update multiple stores and only notify subscribers once at the end:

```ts
import { store, computed, batch } from 'easy-signal';

const a = store(1);
const b = store(2);
const c = computed(() => a.state + b.state);

c.subscribe(aPlusB => console.log('a + b =', aPlusB));

batch(() => {
  a.state = 10;
  b.state = 20;
  // subscribers are notified once here, not twice, "a + b = 30" is only logged once
});
```

### `whenReady` and `whenMatches`

Await a store reaching a certain condition:

```ts
import { store, whenReady, whenMatches } from 'easy-signal';

const user = store<User | null>(null);

// Resolves when the store is no longer null or undefined
const value = await whenReady(user);

// Resolves when a custom condition is met
const admin = await whenMatches(user, u => u?.role === 'admin');
```

### `afterChange`

Await the next change to a store:

```ts
import { store, afterChange } from 'easy-signal';

const count = store(0);

// Wait for the next change
const newValue = await afterChange(count);
```

### Store Classes

`ReadonlyStoreClass<T>` and `StoreClass<T>` are base classes for building your own store-like classes. Use them when
you want a class that behaves as a store without manually delegating `.state` and `.subscribe()`.

```ts
import { ReadonlyStoreClass } from 'easy-signal';

class Timer extends ReadonlyStoreClass<number> {
  constructor() {
    super(0, set => {
      const id = setInterval(() => set(Date.now()), 1000);
      return () => clearInterval(id);
    });
  }
}

const timer = new Timer();
timer.subscribe(value => console.log(value)); // reactive
console.log(timer.state); // current value
```

`StoreClass<T>` extends `ReadonlyStoreClass<T>` and exposes the `.state` setter publicly:

```ts
import { StoreClass } from 'easy-signal';

class Counter extends StoreClass<number> {
  constructor() {
    super(0);
  }

  increment() {
    this.state++;
  }
}
```

The `ReadonlyStore<T>` and `Store<T>` interfaces remain available for typing. Use `implements` for the type contract
and `extends` for the base class:

```ts
import type { ReadonlyStore } from 'easy-signal';

function logStore(store: ReadonlyStore<number>) {
  store.subscribe(v => console.log(v));
}

logStore(new Timer()); // works — Timer satisfies ReadonlyStore<number>
```

### `clearAllContext`

Reset the global reactive context. Useful for test isolation:

```ts
import { clearAllContext } from 'easy-signal';

afterEach(() => {
  clearAllContext();
});
```

## Debounce Utilities

Three debounce functions for controlling how often effects run:

- `onTick(fn)` — debounce until the next microtask
- `onTimeout(fn, delay?)` — debounce until the next `setTimeout`
- `onAnimationFrame(fn)` — debounce until the next animation frame

```ts
import { onAnimationFrame } from 'easy-signal';

const render = onAnimationFrame((x: number, y: number) => {
  element.style.transform = `translate(${x}px, ${y}px)`;
});

// Called many times, but only the last values are used per frame
document.addEventListener('mousemove', e => render(e.clientX, e.clientY));
```
