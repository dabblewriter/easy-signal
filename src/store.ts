import type { Subscriber, Unsubscriber } from './types';
export type Invalidator = () => void;
export type StartStopNotifier<T> = (set: Subscriber<T>, update: (fn: Updater<T>) => void) => Unsubscriber | void;
export type Updater<T> = (value: T) => T;
export type { Subscriber, Unsubscriber };

export interface Readable<T> {
  /**
   * Return the current value.
   */
  get(): T;

  /**
   * Subscribe to changes with a callback. Returns an unsubscribe function.
   */
  subscribe(callback: Subscriber<T>): Unsubscriber;
}

export interface Writable<T> extends Readable<T> {
  /**
   * Set the value and inform subscribers.
   */
  set(value: T): void;

  /**
   * Update the value using the provided function and inform subscribers.
   */
  update(fn: Updater<T>): void;
}

type Context = {
  subscriber: Subscriber<any>;
  invalidate: Invalidator;
  unsubscribes: Set<Unsubscriber>;
};
type Root = {
  context: Context;
  subscriberQueue: Map<Subscriber<any>, any>;
};
type Subscribers<T> = Map<Subscriber<T>, [Unsubscriber, Invalidator?]>;

const noop = () => {};
const subscribersKey = Symbol();

// Ensure 2 versions of the signal library can work together
const symbol = Symbol.for('reactiveStores');
const root: Root =
  globalThis[symbol] ||
  (globalThis[symbol] = {
    context: null,
    subscriberQueue: new Map(),
  });

/**
 * Creates a `Readable` store that allows reading by subscription.
 */
export function readable<T>(initialValue?: T, start?: StartStopNotifier<T>): Readable<T> {
  const { get, subscribe } = writable(initialValue, start);
  return { get, subscribe };
}

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 */
export function writable<T>(value: T, start: StartStopNotifier<T> = noop): Writable<T> {
  let stop: Unsubscriber;
  let started = false;
  const subscribers: Subscribers<T> = new Map();
  set[subscribersKey] = subscribers;

  function get(): T {
    if (root.context) {
      const { subscriber, unsubscribes, invalidate } = root.context;
      const unsubscribe = subscribe(subscriber, invalidate);
      unsubscribes.add(unsubscribe);
    }

    if (!subscribers.size && !started) {
      started = true;
      try {
        (start(set, update) || noop)();
      } finally {
        started = false;
      }
    }

    return value;
  }

  function set(newValue: T): void {
    if (value === newValue) return;
    value = newValue;
    if (stop) {
      // store is ready
      queue(() => {
        subscribers.forEach(([, invalidate], subscriber) => {
          if (!root.subscriberQueue.has(subscriber)) {
            root.subscriberQueue.set(subscriber, value);
            if (invalidate) invalidate();
          }
        });
      });
    }
  }

  function update(fn: Updater<T>) {
    set(fn(value));
  }

  function subscribe(subscriber: Subscriber<T>, invalidate?: Invalidator): Unsubscriber {
    let unsubscribe = subscribers.get(subscriber)?.[0];

    // If already subscribed, return the existing unsubscribe function
    if (unsubscribe) return unsubscribe;

    unsubscribe = () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        stop();
        stop = null;
      }
    };

    subscribers.set(subscriber, [unsubscribe, invalidate]);

    if (subscribers.size === 1) {
      stop = start(set, update) || noop;
    }

    // If invalidate is provided, this comes from a derived store and we should not call the subscriber immediately
    if (!invalidate) {
      subscriber(value);
    }

    return unsubscribe;
  }

  return { get, set, update, subscribe };
}

/**
 * Observe stores and derived values by synchronizing one or more readable stores within an aggregation function.
 */
export function observe<T>(fn: () => T): Unsubscriber {
  const store = derived(fn);
  const unsubscribe = store.subscribe(noop);
  if (store.get() instanceof Promise) {
    throw new Error('observe() should not be used with async methods (it won’t update when dependant stores change).');
  }
  return unsubscribe;
}

/**
 * Create a `Readable` store that derives its value from other stores and updates when those stores change.
 */
export function derived<T>(fn: (priorValue: T) => T, value?: T): Readable<T> {
  let unsubscribes = new Set<Unsubscriber>();

  return readable(value, set => {
    const subscribers = set[subscribersKey] as Subscribers<T>;
    let pending = 0;
    const subscriber = () => --pending === 0 && sync();
    const invalidate = () => {
      pending++;
      // Ensure derived stores that have multiple overlapping dependencies only trigger once after others
      forExistsInBoth(subscribers, root.subscriberQueue, subscriber => {
        // move to the end of the queue
        const value = root.subscriberQueue.has(subscriber);
        root.subscriberQueue.delete(subscriber);
        root.subscriberQueue.set(subscriber, value);
      });
    };

    const sync = () => {
      const prior = root.context;

      // Set the context for the derived function
      root.context = { subscriber, invalidate, unsubscribes: new Set() };

      try {
        // Run the effect collecting all the unsubscribes from the signals that are called when it is run
        value = fn(value);
      } finally {
        // Filter out unchanged unsubscribes, leaving only those which no longer apply
        root.context.unsubscribes.forEach(u => unsubscribes.delete(u));

        // Unsubscribe from all the signals that are no longer needed
        unsubscribes.forEach(u => u());

        // Set the new unsubscribes
        unsubscribes = root.context.unsubscribes;

        // Clear the context
        root.context = prior;
      }
      set(value);
    };

    sync();

    return () => unsubscribes.forEach(u => u());
  });
}

/**
 * Allows setting multiple stores at once and only notifying subscribers once after the batch function is run.
 */
export function batch(fn: () => void) {
  queue(fn, true);
}

/**
 * Provides a promise that resolves when the store is no longer `null` or `undefined` and continues to return the latest
 * value when it changes (i.e. it does not resolve once and remain at that value).
 */
export function whenReadable<T>(store: Readable<T>): Promise<T> {
  return whenMatches(store, v => v != null) as Promise<T>;
}

/**
 * Provides a promise that resolves when the store's value meets the provided condition and will continue to return the
 * latest value as long as it meets the condition. It will not resolve once and remain at that value like a regular
 * promise.
 */
export function whenMatches<T>(store: Readable<T>, matches: (value: T) => boolean): Promise<T> {
  return {
    then: ((resolve: (value: T) => any) => {
      const value = store.get();
      if (matches(value)) return resolve(value);
      const unsubscribe = store.subscribe(value => {
        if (!matches(value)) return;
        unsubscribe();
        resolve(value);
      });
    }),
    catch(){},
    finally(){},
  } as Promise<T>;
}

/**
 * Provides a promise that resolves after the store changes and returns the new value.
 */
export function afterChange<T>(store: Readable<T>): Promise<T> {
  return new Promise(resolve => {
    let init = true;
    const unsubscribe = store.subscribe(value => {
      if (init) return init = false;
      unsubscribe();
      resolve(value);
    });
  });
}

function queue(fn: () => void, batch?: boolean) {
  const runQueue = !root.subscriberQueue.size;
  if (runQueue && batch) {
    // Add a dummy subscriber to the queue to ensure that nobody else runs the queue
    root.subscriberQueue.set(noop, undefined);
  }

  fn();

  if (runQueue) {
    const iter = root.subscriberQueue.entries();
    while (root.subscriberQueue.size > 0) {
      const [subscriber, value] = iter.next().value;
      root.subscriberQueue.delete(subscriber);
      subscriber(value);
    }
  }
}

function forExistsInBoth<T>(a: Map<T, any>, b: Map<T, any>, fn: (value: T) => void) {
  const smallest = a.size <= b.size ? a : b;
  const other = a.size <= b.size ? b : a;
  smallest.forEach((_, key) => other.has(key) && fn(key));
}
