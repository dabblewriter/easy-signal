// Different timings for when to execute an observer observing a signal
export const Timing = {
    // Execute the function on the next tick of the event loop
    Tick: (fn) => {
        Promise.resolve(fn);
    },
    // Execute the function on the next animation frame
    AnimationFrame: (fn) => {
        globalThis.requestAnimationFrame(fn);
    },
};
// The context for the current run and its unsubscribes
let context = null;
// A map to keep track of listeners to subscription changes
const onSubscriptionChanges = new WeakMap();
/**
 * Create a Signal with an initial value and optional options. The options can include an `equals` function which will
 * be used to determine if the new value is different from the current value. If the new value is different, the signal
 * will be updated and all subscribers will be notified.
 * The returned signal function can be called with no arguments to get the current value, with a function argument to
 * run an update function which should receive the value and return a new one, or with a value argument which will
 * replace the signal's current value. The signal function always returns the current value.
 */
export function reactiveSignal(value, options) {
    // A map to keep track of subscribers
    const subscribers = new Map();
    // The signal is a function that will return a value when called without arguments, or update the value when called
    // with an argument. The update value can be a new value or an updater function.
    const signal = ((newValue, set) => {
        // If no new value is provided, subscribe the current run to this signal and return the current value
        if (!set && newValue === undefined) {
            // If there is a context (an observer is running), add the observer's subscriber to the signal
            if (context) {
                const { subscriber: run, unsubscribes } = context;
                let unsubscribe = subscribers.get(run);
                // If the run is not already subscribed, subscribe it
                if (!unsubscribe) {
                    // Create the unsubscribe function
                    unsubscribe = () => {
                        subscribers.delete(run);
                        // If there are no more subscribers, notify the subscription changes
                        if (subscribers.size === 0) {
                            const onChanges = onSubscriptionChanges.get(signal);
                            if (onChanges)
                                onChanges.forEach(onChange => onChange(false));
                        }
                    };
                    // Add the unsubscribe function to the signal's subscribers
                    subscribers.set(run, unsubscribe);
                    // If this changed the number of subscribers from 0 to 1, notify any subscription change subscribers
                    if (subscribers.size === 1) {
                        const onChanges = onSubscriptionChanges.get(signal);
                        if (onChanges)
                            onChanges.forEach(onChange => onChange(true));
                    }
                }
                // Add the unsubscribe function to the run's unsubscribes
                unsubscribes.add(unsubscribe);
            }
            // Return the current value
            return value;
        }
        // If the new value is a function, call it with the current value as an argument
        if (!set && typeof newValue === 'function') {
            newValue = newValue(value);
        }
        // If the new value is different from the current value (according to the equals function if provided), update the
        // value and notify all subscribers
        if (options?.equals ? !options.equals(value, newValue) : value !== newValue) {
            value = newValue;
            subscribers.forEach((_, run) => run(value));
        }
        return value;
    });
    // Return the signal function
    return signal;
}
/**
 * Subscribe to be notified whenever a Signal's value changes. The Subscriber function will be called immediately with
 * the current value of the Signal and again whenever the Signal's value changes.
 *
 * The optional third argument, `timing`, can be used to specify when the function should be called. The default is
 * `Timing.Immediate` which executes the function immediately.
 *
 * The returned function can be called to unsubscribe from the Signal.
 */
export function subscribe(signal, subscriber, timing = Timing.Tick) {
    if (timing) {
        let queued = false;
        const subFn = subscriber;
        subscriber = () => {
            if (!queued) {
                queued = true;
                timing(() => {
                    queued = false;
                    subFn(signal());
                });
            }
        };
    }
    // Set the current context so we can get the unsubscribe
    context = { subscriber, unsubscribes: new Set() };
    // Get the current value of the signal
    const value = signal();
    // Get the unsubscribe function for the subscriber
    const unsubscribe = context.unsubscribes.values().next().value;
    // Clear the current context
    context = null;
    // Call the subscriber with the current value
    subscriber(value);
    // Return the unsubscribe function
    return unsubscribe;
}
/**
 * Get notified when a Signal's subscribers changes from none to some or some to none.
 */
export function onSubscriptionChange(signal, onChange) {
    // Get the set of onChange functions for the signal
    let onChanges = onSubscriptionChanges.get(signal);
    // If there is no set, create one and add it to the map
    if (!onChanges)
        onSubscriptionChanges.set(signal, (onChanges = new Set()));
    // Add the onChange function to the set
    onChanges.add(onChange);
    // Return a function that removes the onChange function from the set
    return () => {
        onChanges.delete(onChange);
    };
}
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
export function observe(fn, timing) {
    let dirty = true;
    let unsubscribes = new Set();
    // Subscribe to all the signals that are called when the effect is run
    const subscriber = () => {
        if (dirty)
            return;
        dirty = true;
        if (timing)
            timing(() => onChange());
        else
            onChange();
    };
    // Called immediately and whenever any of the signals it depends on change (after the timing)
    const onChange = () => {
        if (!dirty)
            return;
        dirty = false;
        // Set the context for the effect
        context = { subscriber, unsubscribes: new Set() };
        // Run the effect collecting all the unsubscribes from the signals that are called when it is run
        fn();
        // Filter out unchanged unsubscribes, leaving only those which no longer apply
        context.unsubscribes.forEach(u => unsubscribes.delete(u));
        // Unsubscribe from all the signals that are no longer needed
        unsubscribes.forEach(u => u());
        // Set the new unsubscribes
        unsubscribes = context.unsubscribes;
        // Clear the context
        context = null;
    };
    // Call immediately (or on the next timing)
    if (timing)
        timing(() => onChange());
    else
        onChange();
    // Return a function that unsubscribes from all the signals that are called when the effect is run
    return () => unsubscribes.forEach(u => u());
}
/**
 * Create a Computed Signal which is a signal that is the result of a function that depends on other signals. The
 * function is called immediately whenever the computed signal is accessed if there are no subscribers, or whenever its
 * dependent signals change if there are subscribers so that subscribers to the computed signal can be informed.
 *
 * The optional second argument, `when`, can be used to specify when updater function should be called. The default is
 * undefined which executes the function immediately after any change to any signal it relies on. This can
 * prevent unnecessary updates if the function is expensive to run.
 */
export function computedSignal(fn, when) {
    // Create the signal
    const signal = reactiveSignal(undefined);
    // Store the unsubscribe function from the observer. We will only observe the function when there are subscribers to
    // this computed signal.
    let unsubscribe = null;
    // Subscribe to the signal's subscription changes so we know when to start and stop observing
    onSubscriptionChange(signal, hasSubscribers => {
        // If there are subscribers, start observing the function
        if (hasSubscribers) {
            if (!unsubscribe)
                unsubscribe = observe(() => signal(fn), when);
        }
        else if (unsubscribe) {
            // If there are no subscribers, stop observing the function
            unsubscribe();
            unsubscribe = null;
        }
    });
    const computed = () => (unsubscribe ? signal() : signal(fn));
    // Return the signal
    return computed;
}
