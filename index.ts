export type Subscriber<T> = (data: T) => any;
export type Unsubscriber = () => void;

export type Signal<T> = {
  (data: T): void;
  (data: Error): void;
  (subscriber: Subscriber<T>): Unsubscriber;
  (errorListener: Subscriber<Error>, options: { captureErrors: true }): Unsubscriber;
}

export const ClearSignal = {};

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
export function signal<T = any>(): Signal<T> {
  const subscribers = new Set<Subscriber<T>>();
  const errorListeners = new Set<Subscriber<Error>>();

  function subscribe(data: T): void;
  function subscribe(error: Error): void;
  function subscribe(subscriber: Subscriber<T>): Unsubscriber;
  function subscribe(listener: Subscriber<Error>, options: { captureErrors: true }): Unsubscriber;
  function subscribe(arg: T | Error | Subscriber<T> | Subscriber<Error>, options?: { captureErrors: true }): Unsubscriber {
    if (typeof arg === 'function') {
      const listeners = options?.captureErrors ? errorListeners : subscribers;
      listeners.add(arg as any);
      return () => {
        listeners.delete(arg as any);
      };
    } else if (arg === ClearSignal) {
      subscribers.clear();
      errorListeners.clear();
    } else if (arg instanceof Error) {
      errorListeners.forEach(listener => listener(arg));
    } else {
      subscribers.forEach(listener => listener(arg));
    }
  }

  return subscribe;
}
