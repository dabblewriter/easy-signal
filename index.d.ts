export declare type Subscriber<T> = (data: T) => any;
export declare type Unsubscriber = () => void;
export declare type Signal<T> = {
    (data: T): void;
    (data: Error): void;
    (subscriber: Subscriber<T>): Unsubscriber;
    (errorListener: Subscriber<Error>, options: {
        captureErrors: true;
    }): Unsubscriber;
};
export declare const ClearSignal: {};
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
export declare function signal<T = any>(): Signal<T>;
