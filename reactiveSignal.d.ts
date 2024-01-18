export interface SignalOptions<T> {
    equals?: false | ((prev: T, next: T) => boolean);
}
export declare type Unsubscribe = () => void;
export declare type Cancel = () => void;
export declare const Timing: {
    Tick: (fn: () => void) => void;
    AnimationFrame: (fn: () => void) => void;
};
/**
 * A Signal is a single getter/setter function that holds a value and notifies subscribers when the value changes
 * The signal function can be called with no arguments to get the current value, with a function argument to run an
 * update function which should receive the value and return a new one, or with a value argument which will replace the
 * signal's current value. The signal function always returns the current value.
 *
 * The optional second argument, `set`, can be used to force the first argument as the new value. This is useful when
 * the first argument is a function or `undefined` since the signal will assume any function is an updater function and
 * any `undefined` value is a request to get the current value.
 */
export declare type ReactiveSignal<T> = {
    (): T;
    (value: T | ReactiveSignalUpdater<T>, set?: false): T;
    (value: T, set: true): T;
};
/**
 * A Computed Signal is a signal that is the result of a function that depends on other signals. The function is called
 * whenever the computed signal is accessed if there are no subscribers, or whenever its dependent signals change if
 * there are subscribers so that subscribers to the computed signal can be informed.
 */
export declare type ComputedSignal<T> = () => T;
/**
 * A Signal Subscriber is a function that will be called whenever the signal's value changes. The subscriber will be
 * called with the new value. The subscriber can be used to update the DOM or trigger other side effects.
 */
export declare type ReactiveSignalSubscriber<T> = (value: T) => void;
/**
 * A Signal Updater is a function that will be called with the current value of the signal and should return a new
 * value. The updater can be used to update the signal's value based on its current value.
 */
export declare type ReactiveSignalUpdater<T> = (prev: T) => T;
/**
 * An Observer is a function that will be called whenever any of the signals it depends on change. The observer can be
 * used to update the DOM or trigger other side effects.
 * The observer will be called immediately (or after certain a timing option) and whenever any of the signals it depends
 * on change.
 */
export declare type ReactiveSignalObserver = () => void;
/**
 * A Timing is a function that will be called with a function to execute. The timing function should execute the passed
 * function at some point in the future. The default timing is `Timing.Immediate` which executes the function
 * immediately.
 */
export declare type Timing = (fn: () => void) => Cancel;
/**
 * A Subscription Change is a function that will be called whenever the signal's subscribers changes from none to some
 * or some to none. The subscription change will be called with a boolean indicating whether there are any subscribers.
 */
export declare type SubscriptionChange = (hasSubscribers: boolean) => void;
/**
 * Create a Signal with an initial value and optional options. The options can include an `equals` function which will
 * be used to determine if the new value is different from the current value. If the new value is different, the signal
 * will be updated and all subscribers will be notified.
 * The returned signal function can be called with no arguments to get the current value, with a function argument to
 * run an update function which should receive the value and return a new one, or with a value argument which will
 * replace the signal's current value. The signal function always returns the current value.
 */
export declare function reactiveSignal<T>(value: T, options?: SignalOptions<T>): ReactiveSignal<T>;
/**
 * Subscribe to be notified whenever a Signal's value changes. The Subscriber function will be called immediately with
 * the current value of the Signal and again whenever the Signal's value changes.
 *
 * The optional third argument, `timing`, can be used to specify when the function should be called. The default is
 * `Timing.Immediate` which executes the function immediately.
 *
 * The returned function can be called to unsubscribe from the Signal.
 */
export declare function subscribe<T>(signal: ReactiveSignal<T>, subscriber: ReactiveSignalSubscriber<T>, timing?: Timing): Unsubscribe;
/**
 * Get notified when a Signal's subscribers changes from none to some or some to none.
 */
export declare function onSubscriptionChange(signal: ReactiveSignal<any>, onChange: (hasSubscribers: boolean) => void): Unsubscribe;
/**
 * Calls an Observer function after Timing amount of time (default is immediate, but can be on the next tick or the next
 * animation frame) and again after Timing whenever any of the signals it depends on change.
 * The Observer function will be called immediately (or after the timing) and again whenever any of the signals it
 * depends on change.
 * The returned function can be called to unsubscribe from the signals that are called when the effect is run.
 *
 * The optional second argument, `timing`, can be used to specify when the function should be called. The default is
 * undefined which executes the function immediately.
 */
export declare function observe(fn: ReactiveSignalObserver, timing?: Timing): Unsubscribe;
/**
 * Create a Computed Signal which is a signal that is the result of a function that depends on other signals. The
 * function is called immediately whenever the computed signal is accessed if there are no subscribers, or whenever its
 * dependent signals change if there are subscribers so that subscribers to the computed signal can be informed.
 *
 * The optional second argument, `when`, can be used to specify when updater function should be called. The default is
 * undefined which executes the function immediately after any change to any signal it relies on. This can
 * prevent unnecessary updates if the function is expensive to run.
 */
export declare function computedSignal<T>(fn: ReactiveSignalUpdater<T>, when?: Timing): ComputedSignal<T>;
