# Easy Signal

Two simple interfaces for creating two types of signals. The first (and original signal in this module) is a defined
event that can be triggered and listened to with a single function. The second is a defined data store that allows you
to react to changes to that data (popularized by solid-js). These two are `EventSignal` and `ReactiveSignal`.

Full type safety with TypeScript with both use-cases.

## Installation

```
npm install easy-signal
```

## EventSignal Usage

An EventSignal is a function that represents a single event. The function can be used to subscribe to be notified of
the events as well as to trigger them.

EventSignals offer similar functionality as the browser's `eventDispatcher` API, but rather than a general API for any
event, each event would use its own signal. This allows each signal to have a specific function signature as opposed to
the browser's generic `event` object. This is a great system in TypeScript being able to see the exact data each event
produces.

### EventSignal Basic Usage

```ts
// file seconds.ts
import { eventSignal } from 'easy-signal';

// Create the signal and export it for use. Optionally provide the subscriber signature
export const onSecond = eventSignal<number>();

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
import { eventSignal, ForErrors } from 'easy-signal';

const dataStream = eventSignal();

dataStream(data => console.log('data is:' data));
dataStream(error => console.log('Error is:' error), ForErrors);

stream.on('data', obj => dataStream(obj));
stream.on('error', err => dataStream(err));
```

To get a subscriber-only method for external use, pass in the `GetOnSignal` constant.

```ts
import { eventSignal, GetOnSignal } from 'easy-signal';

function getMyAPI() {
  const doSomething = eventSignal();

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

## ReactiveSignal Usage

A ReactiveSignal is a function that represents a single piece of data. The function can be used to get the data, set the
data, and update the data with an updater function. To subscribe to changes use the separate `subscribe` function. The
ReactiveSignal allows for Observers to be created, which are functions that will be rerun whenever any ReactiveSignals
they access are updated, and ComputedSignals which are read-only signals whose value is derived from other signals and
which will be updated whenever they are.

### ReactiveSignal Basic Usage

Here we will use an example similar to the EventSignal, but unlike the EventSignal, the current seconds since epoch will
be stored and can be accessed any time, whereas the EventSignal only fires an event with the data provided. This
particular example isn't very compelling.

```ts
// file seconds.ts
import { reactiveSignal } from 'easy-signal';

// Create the signal and export it for use. Optionally provide the subscriber signature
export const onSecond = reactiveSignal(0);

// Passing a non-function value will dispatch the event
setInterval(() => {
  const currentSecond = Math.floor(Date.now() / 1000);
  onSecond(currentSecond);
  // or onSecond(currentValue => newValue) to update
});
```

```ts
import { onSecond, subscribe } from './seconds.ts';

// Get the value of onSecond() at any time
console.log(onSecond(), 'since epoc');

// Typescript knows that seconds is a number because of the concrete type definition in seconds.ts
const unsubscribe = subscribe(onSecond, seconds => {
  console.log(seconds, 'since epoc');
});
```

### Observer Basic Usage

To take action whenever data changes, you can observe or more signals by accessing them in a function call. You can also
prevent that function from being called too often when data changes by using the Timings. Below, we update the content
of the DOM whenever the user or billing data is updated, but we only do it after an animation frame to prevent the DOM
updates from being too frequent. Providing no Timing will call the function immediately after any data is changed.

Because `user()` and `billing()` are called the first time the observe function is run, it automatically subscribes to
know when they are changed so that the function may be rerun.

```ts
import { reactiveSignal, observe, Timing } from 'easy-signal';

const user = reactiveSignal(userData);
const billing = reactiveSignal(billingData);

const unobserve = observe(() => {
  document.body.innerText = `${user().name} has the plan ${billing().plan}`;
}, Timing.AnimationFrame);
```

### ComputedSignal Basic Usage

Create read-only signals whose value is derived from other signals and which will be updated whenever they are.

```ts
import { computedSignal, subscribe } from 'easy-signal';
import { user, billing } from 'my-other-signals';

const delinquent = computedSignal(() => {
  if (user().subscribed) {
    return billing().status === 'delinquent';
  }
  return false;
});

subscribe(delinquent, delinquent => {
  console.log(`The user is${delinquent ? '' : ' not'} delinquent`);
});
```
