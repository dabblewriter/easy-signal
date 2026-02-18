import type { Unsubscriber } from './types.js';

export type SignalSubscriber = (...args: any[]) => any;
export type ErrorSubscriber = (error: Error) => any;
export type { Unsubscriber };
type Args<T> = T extends (...args: infer A) => any ? A : never;

export type Signal<T extends SignalSubscriber = SignalSubscriber> = {
  (subscriber: T): Unsubscriber;
  error: (errorListener: ErrorSubscriber) => Unsubscriber;
  emit: (...args: Args<T>) => Promise<void>;
  emitError: (error: Error) => Promise<void>;
  clear: () => void;
};

/**
 * Creates a signal, a function that can be used to subscribe to events. The signal can be called with a subscriber
 * function to register event listeners. It has methods for emitting events, handling errors, and managing subscriptions.
 *
 * @example
 * const onLoad = signal<(data: string) => void>();
 *
 * // Subscribe to data
 * onLoad((data) => console.log('loaded', data));
 *
 * // Subscribe to errors
 * onLoad.error((error) => console.error('error', error));
 *
 * // Emit data to subscribers
 * await onLoad.emit('data'); // logs 'loaded data'
 *
 * // Emit an error to error listeners
 * await onLoad.emitError(new Error('something failed'));
 *
 * // Clear all subscribers
 * onLoad.clear();
 */
export function signal<T extends SignalSubscriber = SignalSubscriber>(): Signal<T> {
  const subscribers = new Set<SignalSubscriber>();
  const errorListeners = new Set<ErrorSubscriber>();

  function signal(subscriber: T): Unsubscriber {
    subscribers.add(subscriber);
    return () => {
      subscribers.delete(subscriber);
    };
  }

  signal.emit = async (...args: Args<T>) => {
    await Promise.allSettled(Array.from(subscribers).map(listener => listener(...args)));
  };

  signal.emitError = async (error: Error) => {
    await Promise.allSettled(Array.from(errorListeners).map(listener => listener(error)));
  };

  signal.error = (errorListener: ErrorSubscriber): Unsubscriber => {
    errorListeners.add(errorListener);
    return () => {
      errorListeners.delete(errorListener);
    };
  };

  signal.clear = () => {
    subscribers.clear();
    errorListeners.clear();
  };

  return signal;
}
