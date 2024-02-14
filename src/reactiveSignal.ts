// The options for a Signal
export interface SignalOptions<T> {
  equals?: false | ((prev: T, next: T) => boolean);
}

// The types for an unsubscribe and cancel function
export type Unsubscribe = () => void;
export type Cancel = () => void;

// Different timings for when to execute an observer observing a signal
export const Timing = {
  // Execute the function on the next tick of the event loop
  Tick: (fn: () => void) => {
    Promise.resolve().then(fn);
  },
  // Execute the function on the next animation frame
  AnimationFrame: (fn: () => void) => {
    (globalThis as any).requestAnimationFrame(fn);
  },
};

// The context for the current run and its unsubscribes
type Context = { prior: Context | null; subscriber: ReactiveSignalSubscriber<any>; unsubscribes: Set<Unsubscribe> };
let context: Context | null = null;
let getHasSubscribers = false;

// A map to keep track of listeners to subscription changes
const onSubscriptionChanges = new WeakMap<ReactiveSignal<any>, Set<SubscriptionChange>>();

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
export interface ReactiveSignal<T> extends ComputedSignal<T> {
  (value: T | ReactiveSignalUpdater<T>, set?: false): T;
  (value: T, set: true): T;
}

/**
 * A Computed Signal is a signal that is the result of a function that depends on other signals. The function is called
 * whenever the computed signal is accessed if there are no subscribers, or whenever its dependent signals change if
 * there are subscribers so that subscribers to the computed signal can be informed.
 */
export interface ComputedSignal<T> {
  (): T;
  subscribe: (subscriber: ReactiveSignalSubscriber<T>, when?: Timing | null, deferInitial?: boolean) => Unsubscribe;
}

/**
 * A Signal Subscriber is a function that will be called whenever the signal's value changes. The subscriber will be
 * called with the new value. The subscriber can be used to update the DOM or trigger other side effects.
 */
export type ReactiveSignalSubscriber<T> = (value: T) => void;

/**
 * A Signal Updater is a function that will be called with the current value of the signal and should return a new
 * value. The updater can be used to update the signal's value based on its current value.
 */
export type ReactiveSignalUpdater<T> = (prev: T) => T;

/**
 * An Observer is a function that will be called whenever any of the signals it depends on change. The observer can be
 * used to update the DOM or trigger other side effects.
 * The observer will be called immediately (or after certain a timing option) and whenever any of the signals it depends
 * on change.
 */
export type ReactiveSignalObserver = () => void;

/**
 * A Timing is a function that will be called with a function to execute. The timing function should execute the passed
 * function at some point in the future. The default timing is `Timing.Immediate` which executes the function
 * immediately.
 */
export type Timing = (fn: () => void) => void;

/**
 * A Subscription Change is a function that will be called whenever the signal's subscribers changes from none to some
 * or some to none. The subscription change will be called with a boolean indicating whether there are any subscribers.
 */
export type SubscriptionChange = (hasSubscribers: boolean) => void;

/**
 * Create a Signal with an initial value and optional options. The options can include an `equals` function which will
 * be used to determine if the new value is different from the current value. If the new value is different, the signal
 * will be updated and all subscribers will be notified.
 * The returned signal function can be called with no arguments to get the current value, with a function argument to
 * run an update function which should receive the value and return a new one, or with a value argument which will
 * replace the signal's current value. The signal function always returns the current value.
 */
export function reactiveSignal<T>(value: T, options?: SignalOptions<T>): ReactiveSignal<T> {
  // A map to keep track of subscribers
  const subscribers = new Map<ReactiveSignalSubscriber<T>, Unsubscribe>();

  // The signal is a function that will return a value when called without arguments, or update the value when called
  // with an argument. The update value can be a new value or an updater function.
  const signal = ((newValue?: T | ReactiveSignalUpdater<T>, set?: boolean) => {
    // If no new value is provided, subscribe the current run to this signal and return the current value
    if (!set && newValue === undefined) {
      if (getHasSubscribers) return subscribers.size > 0;

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
              if (onChanges) onChanges.forEach(onChange => onChange(false));
            }
          };

          // Add the unsubscribe function to the signal's subscribers
          subscribers.set(run, unsubscribe);

          // If this changed the number of subscribers from 0 to 1, notify any subscription change subscribers
          if (subscribers.size === 1) {
            const onChanges = onSubscriptionChanges.get(signal);
            if (onChanges) onChanges.forEach(onChange => onChange(true));
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
      newValue = (newValue as ReactiveSignalUpdater<T>)(value);
    }

    // If the new value is different from the current value (according to the equals function if provided), update the
    // value and notify all subscribers
    if (options?.equals ? !options.equals(value!, newValue as T) : value !== newValue) {
      value = newValue as T;
      subscribers.forEach((_, run) => run(value!));
    }
    return value;
  }) as ReactiveSignal<T>;

  signal.subscribe = (subscriber: ReactiveSignalSubscriber<T>, timing: Timing | null = Timing.Tick) =>
    subscribe(signal, subscriber, timing);

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
export function subscribe<T>(
  signal: ReactiveSignal<T>,
  changeHandler: ReactiveSignalSubscriber<T>,
  timing: Timing | null = Timing.Tick,
  deferInitial = false
): Unsubscribe {
  let subscriber: ReactiveSignalSubscriber<T>;
  if (timing) {
    let queued = false;
    subscriber = () => {
      if (!queued) {
        queued = true;
        timing(() => {
          queued = false;
          changeHandler(signal());
        });
      }
    };
  } else {
    subscriber = changeHandler;
  }

  // Set the current context so we can get the unsubscribe
  context = { prior: context, subscriber, unsubscribes: new Set() };

  // Get the current value of the signal
  const value = signal();

  // Get the unsubscribe function for the subscriber
  const unsubscribe = context.unsubscribes.values().next().value;

  // Clear the current context
  context = context.prior;

  // Call the changeHandler with the current value immediately, regardless of timing, unless deferred
  deferInitial ? subscriber(value) : changeHandler(value);

  // Return the unsubscribe function
  return unsubscribe;
}

/**
 * Get notified when a Signal's subscribers changes from none to some or some to none.
 */
export function onSubscriptionChange(
  signal: ReactiveSignal<any>,
  onChange: (hasSubscribers: boolean) => void
): Unsubscribe {
  // Get the set of onChange functions for the signal
  let onChanges = onSubscriptionChanges.get(signal)!;

  // If there is no set, create one and add it to the map
  if (!onChanges) onSubscriptionChanges.set(signal, (onChanges = new Set()));

  // Add the onChange function to the set
  onChanges.add(onChange);

  // Pretty little hack to get the current value of hasSubscribers
  getHasSubscribers = true;
  const hasSubscribers = signal();
  getHasSubscribers = false;
  onChange(hasSubscribers);

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
export function observe(fn: ReactiveSignalObserver, timing?: Timing, deferInitial?: boolean): Unsubscribe {
  let dirty = true;
  let unsubscribes = new Set<Unsubscribe>();

  // Subscribe to all the signals that are called when the effect is run
  const subscriber = () => {
    if (dirty) return;
    dirty = true;
    if (timing) timing(() => onChange());
    else onChange();
  };

  // Called immediately and whenever any of the signals it depends on change (after the timing)
  const onChange = () => {
    if (!dirty) return;
    dirty = false;

    // Set the context for the effect
    context = { prior: context, subscriber, unsubscribes: new Set() };

    // Run the effect collecting all the unsubscribes from the signals that are called when it is run
    fn();

    // Filter out unchanged unsubscribes, leaving only those which no longer apply
    context.unsubscribes.forEach(u => unsubscribes.delete(u));

    // Unsubscribe from all the signals that are no longer needed
    unsubscribes.forEach(u => u());

    // Set the new unsubscribes
    unsubscribes = context.unsubscribes;

    // Clear the context
    context = context.prior;
  };

  // Call immediately (or on the next timing)
  if (deferInitial && timing) timing(() => onChange());
  else onChange();

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
export function computedSignal<T>(
  fn: ReactiveSignalUpdater<T>,
  when?: Timing,
  deferInitial?: boolean
): ComputedSignal<T> {
  // Create the signal
  const signal = reactiveSignal<T>(undefined as T);

  // Store the unsubscribe function from the observer. We will only observe the function when there are subscribers to
  // this computed signal.
  let unsubscribe: Unsubscribe | null = null;

  // Subscribe to the signal's subscription changes so we know when to start and stop observing
  onSubscriptionChange(signal, hasSubscribers => {
    // If there are subscribers, start observing the function
    if (hasSubscribers) {
      if (!unsubscribe) unsubscribe = observe(() => signal(fn), when, deferInitial);
    } else if (unsubscribe) {
      // If there are no subscribers, stop observing the function
      unsubscribe();
      unsubscribe = null;
    }
  });

  const computed = () => (unsubscribe ? signal() : signal(fn));
  computed.subscribe = signal.subscribe;

  // Return the signal
  return computed;
}
