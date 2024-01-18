type Args<T> = T extends (...args: infer A) => any ? A : never;
export type EventSignalSubscriber = (...args: any[]) => any;
export type ErrorSubscriber = (error: Error) => any;
export type Unsubscriber = () => void;

export type OnSignal<T extends EventSignalSubscriber = EventSignalSubscriber> = {
  (subscriber: T): Unsubscriber;
  (errorListener: ErrorSubscriber, what: typeof ForErrors): Unsubscriber;
};

export type EventSignal<T extends EventSignalSubscriber = EventSignalSubscriber> = OnSignal<T> & {
  (...args: Args<T>): void;
  (data: Error): void;
  (data: typeof ClearSignal): void;
  (data: typeof GetOnSignal): OnSignal<T>;
};

export const ClearSignal = Symbol();
export const GetOnSignal = Symbol();
export const ForErrors = Symbol();

/**
 * Creates a signal, a function that can be used to subscribe to events. The signal can be called with a subscriber
 * function, which will be called when the signal is dispatched. The signal can also be called with data, which will
 * dispatch to all subscribers. An optional second argument can be passed to subscribe to errors instead. When the
 * signal is called with an instance of Error, it will dispatch to all error listeners.
 * The signal can also be called with `ClearSignal`, which will clear all subscribers.
 * @example
 * const onLoad = signal();
 *
 * // Subscribe to data
 * onLoad((data) => console.log('loaded', data));
 * onLoad((error) => console.error('error', error), true);
 *
 * // Dispatch data
 * onLoad('data'); // logs 'loaded data'
 * onLoad(new Error('error')); // logs 'error Error: error'
 */
export function eventSignal<T extends EventSignalSubscriber = EventSignalSubscriber>(): EventSignal<T> {
  const subscribers = new Set<EventSignalSubscriber>();
  const errorListeners = new Set<EventSignalSubscriber>();

  function onSignal(subscriber: T | ErrorSubscriber, what?: typeof ForErrors): Unsubscriber {
    const listeners = what === ForErrors ? errorListeners : subscribers;
    listeners.add(subscriber);
    return () => {
      listeners.delete(subscriber);
    };
  }

  function signal(...args: Args<T>): void;
  function signal(error: Error): void;
  function signal(data: typeof ClearSignal): void;
  function signal(data: typeof GetOnSignal): OnSignal<T>;
  function signal(subscriber: T): Unsubscriber;
  function signal(errorListener: EventSignalSubscriber, what: typeof ForErrors): Unsubscriber;
  function signal(...args: any[]): Unsubscriber | OnSignal<T> | void {
    const arg = args[0];
    if (typeof arg === 'function') {
      return onSignal(arg);
    } else if (arg === ClearSignal) {
      subscribers.clear();
      errorListeners.clear();
    } else if (arg === GetOnSignal) {
      return onSignal as OnSignal<T>;
    } else if (arg instanceof Error) {
      errorListeners.forEach(listener => listener(arg));
    } else {
      subscribers.forEach(listener => listener(...args));
    }
  }

  return signal;
}
