# Easy Signal

Two interfaces for creating two types of signals. The first (and original signal in this module) is a function that
defines an event and can be triggered and listened to with the single function. The second is a reactive data store that
allows to react to changes (popularized by solid-js). These two are `Signal` and `Atom`.

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

## Atom Usage

An Atom is a function that represents a single piece of data. The function can be used to get the data and set the
data. A `subscribe` function allows reacting to changes on the data in an atom. An `observe` function allows for a
function to be rerun whenever any atoms it depends on are changed. And a `derived` function allows a readonly atom to
be created which depends on, or is derived from, other atoms.

### Atom Basic Usage

Here we will use an example similar to the Signal, but unlike the Signal, the current seconds since epoch will
be stored and can be accessed any time, whereas the Signal only fires an event with the data provided. This
particular example isn't very compelling.

```ts
// file seconds.ts
import { atom } from 'easy-signal';

// Create the signal and export it for use. Optionally provide the subscriber signature
export const onSecond = atom(0);

// Passing a non-function value will dispatch the event
setInterval(() => {
  const currentSecond = Math.floor(Date.now() / 1000);
  onSecond(currentSecond);
});
```

```ts
import { onSecond } from './seconds.ts';

// Get the value of onSecond() at any time
console.log(onSecond(), 'since epoc');

// Typescript knows that seconds is a number because of the concrete type definition in seconds.ts
const unsubscribe = onSecond.subscribe(seconds => {
  console.log(seconds, 'since epoc');
});
```

### `observe` Basic Usage

To take action whenever data changes, you can observe one or more signals by accessing them in a function call. Below,
we update the content of the DOM whenever the user or billing data is updated, but we only do it after an animation
frame to prevent the DOM updates from being too frequent.

Because `user()` and `billing()` are called the first time the observe function is run, it automatically subscribes to
know when they are changed so that the function may be rerun.

```ts
import { atom, observe, onAnimationFrame } from 'easy-signal';

const user = atom(userData);
const billing = atom(billingData);

const updateDom = onAnimationFrame((name, plan) => {
  document.body.innerText = `${user().name} has the plan ${billing().plan}`;
});

const unobserve = observe(() => {
  updateDom(user().name, billing().plan);
});
```

### `derived` Basic Usage

Create read-only signals whose value is derived from other signals and which will be updated whenever they are.

```ts
import { derived } from 'easy-signal';
import { user, billing } from 'my-other-signals';

const delinquent = derived(() => {
  if (user().subscribed) {
    return billing().status === 'delinquent';
  }
  return false;
});

delinquent.subscribe(delinquent => {
  console.log(`The user is${delinquent ? '' : ' not'} delinquent`);
});
```
