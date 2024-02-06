import { ReactiveSignal, ReactiveSignalSubscriber, subscribe } from './reactiveSignal';

/**
 * A store wrapper around a reactive signal. The store can be used to get, set, update, and subscribe to the signal.
 * This is for use in Svelte 3-4.
 */
export function signalStore<T>(signal: ReactiveSignal<T>) {
  return {
    get: signal,
    set: signal,
    update: signal,
    subscribe: (sub: ReactiveSignalSubscriber<T>) => subscribe(signal, sub),
  };
}
