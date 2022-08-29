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

// Create the signal and export it for outside use
export const onSecond = signal<(second: number) => any>();

setInterval(() => onMessage.dispatch(Math.floor(Date.now() / 1000)));
```

```ts
import { onSecond } from './seconds.ts';

// Typescript knows that seconds is a number because of the concrete type definition in seconds.ts
const unsubscribe = onSecond(seconds => {
  console.log(seconds, 'since epoc');
});
```
