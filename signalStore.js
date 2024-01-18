import { subscribe } from './reactiveSignal';
/**
 * A store wrapper around a reactive signal. The store can be used to get, set, update, and subscribe to the signal.
 * This is for use in Svelte 3-4.
 */
export function signalStore(signal) {
    return {
        get: signal,
        set: signal,
        update: signal,
        subscribe: (sub) => subscribe(signal, sub),
    };
}
