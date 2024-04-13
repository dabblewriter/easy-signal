# Easy Signal

Two interfaces for creating two types of signals. The first (and original signal in this module) is a function that
defines an event and can be triggered and listened to with the single function. The second is a reactive data store that
allows to react to changes (popularized by solid-js). These two are `Signal` and `Readable`/`Writable`.

Full type safety with TypeScript with both use-cases.

## Installation

```
npm install easy-signal
```

## Signal Usage

A Signal is a function that represents a single event. The function can be used to subscribe to be notified of
the events as well as to trigger them.

Signals offer similar functionality as the browser's `eventDispatcher` API, but rather than a general API for any
event, each event would use its own signal. This allows each signal to have a specific function signature as opposed to
the browser's generic `event` object. This is a great system in TypeScript being able to see the exact data each event
produces.

### Signal Basic Usage

```ts
// file seconds.ts
import { signal } from 'easy-signal';

// Create the signal and export it for use. Optionally provide the subscriber signature
export const onSecond = signal<number>();

// Passing a non-function value will dispatch the event
setInterval(() => {
  const currentSecond = Math.floor(Date.now() / 1000);
  onSecond(currentSecond);
});
```

```ts
import { onSecond } from './seconds.ts';

// Typescript knows that seconds is a number because of the concrete type definition in seconds.ts
const unsubscribe = onSecond(seconds => {
  console.log(seconds, 'since epoc');
});
```

Errors may also be listened to from the signal by passing `ForErrors` as the second parameter when adding the listener
and errors may be dispatched by passing an Error object to the signal method.

```ts
import { signal, ForErrors } from 'easy-signal';

const dataStream = signal();

dataStream(data => console.log('data is:' data));
dataStream(error => console.log('Error is:' error), ForErrors);

stream.on('data', obj => dataStream(obj));
stream.on('error', err => dataStream(err));
```

To get a subscriber-only method for external use, pass in the `GetOnSignal` constant.

```ts
import { signal, GetOnSignal } from 'easy-signal';

function getMyAPI() {
  const doSomething = signal();

  // doSomething() will trigger subscribers that were added in onSomething(...). This protects the signal from being
  // triggered/dispatched outside of `getMyAPI`. Sometimes you may want more control to prevent just anyone from
  // triggering the event.

  return {
    onSomething: doSomething(GetOnSignal),
  };
}
```

To clear the listeners from the signal, pass in the `ClearSignal` constant.

```ts
import { signal, ClearSignal } from 'easy-signal';

const onSomething = signal();

onSomething(ClearSignal); // clears signal
```

## Store Usage

A store is an object that represents a single piece of data. The store's methods can be used to `get`, `set`, and
`update` the data and `subscribe` to changes on the data. An `observe` function allows for a given function to be rerun
whenever any stores it depends on are changed. And a `derived` function allows a readonly store to be created which
depends on, or is derived from, other stores. Both `observe` and `derived` automatically track dependencies within the
scope of their function.

### Store Basic Usage

Here we will use an example similar to the Signal, but unlike the Signal, the current seconds since epoch will
be stored and can be accessed any time, whereas the Signal only fires an event with the data provided. This
particular example isn't very compelling.

```ts
// file seconds.ts
import { writable } from 'easy-signal';

// Create the signal and export it for use. Optionally provide the subscriber signature
export const onSecond = writable(0);

// Passing a non-function value will dispatch the event
setInterval(() => {
  const currentSecond = Math.floor(Date.now() / 1000);
  onSecond.set(currentSecond);
});
```

```ts
import { onSecond } from './seconds.ts';

// Get the value of onSecond.get() at any time
console.log(onSecond.get(), 'since epoc');

// Typescript knows that seconds is a number because of the concrete type definition in seconds.ts
const unsubscribe = onSecond.subscribe(seconds => {
  console.log(seconds, 'since epoc');
});
```

### `observe` Basic Usage

To take action whenever data changes, you can observe one or more signals by accessing them in a function call. Below,
we update the content of the DOM whenever the user or billing data is updated, but we only do it after an animation
frame to prevent the DOM updates from being too frequent.

Because `user.get()` and `billing.get()` are called the first time the observe function is run, it automatically
subscribes to know when they are changed so that the function may be rerun.

Note that easy-signal provides 3 simple debounce functions to make it easy to have effects happen less often while still
allowing the stores to always be accurate:
- `onAnimationFrame`
- `onTick`
- `onTimeout`

```ts
import { writable, observe, onAnimationFrame } from 'easy-signal';

const user = writable(userData);
const billing = writable(billingData);

const updateDom = onAnimationFrame((name, plan) => {
  // will be called with only the most recent values if updateDom was called multiple times between frames
  document.body.innerText = `${name} has the plan ${plan}`;
});

const unobserve = observe(() => {
  updateDom(user.get().name, billing.get().plan);
});
```

### `derived` Basic Usage

Create read-only signals whose value is derived from other signals and which will be updated whenever they are.

```ts
import { derived } from 'easy-signal';
import { user, billing } from 'my-other-signals';

const delinquent = derived(() => {
  if (user.get().subscribed) {
    return billing.get().status === 'delinquent';
  }
  return false;
});

delinquent.subscribe(delinquent => {
  console.log(`The user is${delinquent ? '' : ' not'} delinquent`);
});
```

`batch(fn: () => void)` allows updating multiple stores and only triggering those updates once at the end.
