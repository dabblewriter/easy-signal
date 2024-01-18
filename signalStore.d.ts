import { ReactiveSignal, ReactiveSignalSubscriber } from './reactiveSignal';
/**
 * A store wrapper around a reactive signal. The store can be used to get, set, update, and subscribe to the signal.
 * This is for use in Svelte 3-4.
 */
export declare function signalStore<T>(signal: ReactiveSignal<T>): {
    get: ReactiveSignal<T>;
    set: ReactiveSignal<T>;
    update: ReactiveSignal<T>;
    subscribe: (sub: ReactiveSignalSubscriber<T>) => import("./reactiveSignal").Unsubscribe;
};
