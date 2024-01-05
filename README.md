# Easy Signal

A simple interface for creating a defined event or action that can be triggered with a set API and listened to by any number of subscribers.

## Installation

```
npm install easy-signal
```

## Usage

A signal is a subscriber function that represents a single event. A signal function (the subscriber) has a function attached to it called `dispatch()` to trigger the event.

Signals offer similar functionality as the browser's `eventDispatcher` API, but rather than a general API for any event, each event would use its own signal. This allows each signal to have a specific function signature as opposed to the browser's generic `event` object. This is a great system in TypeScript being able to see the exact data each event produces.

### Basic Usage

```ts
// file seconds.ts
import { signal } from 'easy-signal';

// Create the signal and export it for use. Optionally provide the subscriber signature
export const onSecond = signal<number>();

// Passing a non-function value will dispatch the event
setInterval(() => onSecond(Math.floor(Date.now() / 1000)));
```

```ts
import { onSecond } from './seconds.ts';

// Typescript knows that seconds is a number because of the concrete type definition in seconds.ts
const unsubscribe = onSecond(seconds => {
  console.log(seconds, 'since epoc');
});
```

Errors may also be listened to and dispatched from the signal by using the second parameter when adding the listener
and by passing an Error object to the dispatch.

```ts
import { signal } from 'easy-signal';

const dataStream = signal();

dataStream(data => console.log('data is:' data));
dataStream(error => console.log('Error is:' error), { captureErrors: true });

stream.on('data', obj => dataStream(obj));
stream.on('error', err => dataStream(err));
```

To clear the listeners from the signal, pass in the `ClearSignal` constant.

```ts
import { signal, ClearSignal } from 'easy-signal';

const onSomething = signal();

onSomething(ClearSignal); // clears signal
```
