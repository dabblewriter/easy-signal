import { ComputedSignal, ReactiveSignal, Unsubscribe } from './reactiveSignal';

export interface SignalReadStore<T> {
  get(): T;
  subscribe(sub: (value: T) => void): Unsubscribe;
}

export interface SignalWriteStore<T> extends SignalReadStore<T> {
  set(value: T): void;
  update(updater: (value: T) => T): void;
}

/**
 * A store wrapper around a reactive signal. The store can be used to get, set, update, and subscribe to the signal.
 * This is for use in Svelte 3-4.
 */
export function signalStore<T>(signal: ComputedSignal<T>): SignalReadStore<T>;
export function signalStore<T>(signal: ReactiveSignal<T>): SignalWriteStore<T>;
export function signalStore<T>(signal: ReactiveSignal<T> | ComputedSignal<T>): SignalReadStore<T> | SignalWriteStore<T> {
  const isComputed = signal.length === 0;
  return {
    get: signal,
    set: !isComputed && signal,
    update: !isComputed && signal,
    subscribe: signal.subscribe,
  };
}
