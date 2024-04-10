import { ReactiveSignal, ReactiveSignalSubscriber, Unsubscribe, subscribe } from './reactiveSignal';

export interface SignalStore<T> {
  get(): T;
  set(value: T): void;
  update(updater: (value: T) => T): void;
  subscribe(sub: (value: T) => void): Unsubscribe;
}

/**
 * A store wrapper around a reactive signal. The store can be used to get, set, update, and subscribe to the signal.
 * This is for use in Svelte 3-4.
 */
export function signalStore<T>(signal: ReactiveSignal<T>): SignalStore<T> {
  return {
    get: signal,
    set: signal,
    update: signal,
    subscribe: (sub: ReactiveSignalSubscriber<T>) => subscribe(signal, sub),
  };
}
