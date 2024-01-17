# Easy Signal

A simple interface for creating a defined event or action that can be triggered and listened to by any number of
subscribers. Producing a single function that can be used to subscribe to the events, subscribe to errors, and dispatch
events and errors.

Full type safety with TypeScript providing good autocomplete.

## Installation

```
npm install easy-signal
```

## Usage

A signal is a function that represents a single event. The function can be used to subscribe to be notified of the
events as well as to trigger them.

Signals offer similar functionality as the browser's `eventDispatcher` API, but rather than a general API for any event,
each event would use its own signal. This allows each signal to have a specific function signature as opposed to the
browser's generic `event` object. This is a great system in TypeScript being able to see the exact data each event
produces.

### Basic Usage

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
