import type { Subscriber, Unsubscriber } from './types';
type Invalidator = () => void;
type StartStopNotifier<T> = (set: Subscriber<T>, update: (fn: Updater<T>) => void) => Unsubscriber | void;
export type Updater<T> = (value: T) => T;
export type { Subscriber, Unsubscriber };

export interface ReadonlyStore<T> {
  /**
   * Return the current value.
   */
  readonly state: T;

  /**
   * Subscribe to changes with a callback. Returns an unsubscribe function.
   * Pass `false` as the second argument to skip the immediate initial call.
   */
  subscribe(callback: Subscriber<T>, noInit?: false): Unsubscriber;
}

export interface Store<T> extends ReadonlyStore<T> {
  /**
   * Get or set the current value.
   */
  state: T;

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

const noop = () => { };
const subscribersKey = Symbol();

// Ensure 2 versions of the store library can work together
const symbol = Symbol.for('reactiveStores');
const root: Root =
  globalThis[symbol] ||
  (globalThis[symbol] = {
    context: null,
    subscriberQueue: new Map(),
  });

/**
 * Clear the global reactive store context. Useful for testing to ensure a clean state between tests.
 */
export function clearAllContext() {
  root.context = null;
  root.subscriberQueue = new Map();
}

/**
 * Creates a `ReadonlyStore` that allows reading by subscription.
 */
export function readonly<T>(initialValue?: T, start?: StartStopNotifier<T>): ReadonlyStore<T> {
  const s = store(initialValue, start);
  return {
    get state() {
      return s.state;
    },
    subscribe: s.subscribe,
  };
}

/**
 * Create a `Store` that allows both updating and reading by subscription.
 */
export function store<T>(value: T, start: StartStopNotifier<T> = noop): Store<T> {
  let stop: Unsubscriber;
  let started = false;
  const subscribers: Subscribers<T> = new Map();
  set[subscribersKey] = subscribers;

  function hasValueOf(value: any): value is { valueOf(): any } {
    return value && typeof value.valueOf === 'function';
  }

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
    if (value === newValue || (hasValueOf(value) && hasValueOf(newValue) && value.valueOf() === newValue.valueOf())) {
      return;
    }
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

  function subscribe(subscriber: Subscriber<T>, invalidate?: Invalidator | false): Unsubscriber {
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

    subscribers.set(subscriber, [unsubscribe, invalidate || undefined]);

    if (subscribers.size === 1) {
      stop = start(set, update) || noop;
    }

    // If invalidate is provided or false is passed, do not call the subscriber immediately
    if (invalidate === undefined) {
      subscriber(value);
    }

    return unsubscribe;
  }

  return {
    get state() {
      return get();
    },
    set state(newValue: T) {
      set(newValue);
    },
    update,
    subscribe,
  };
}

/**
 * Watch stores and computed values by running a function whenever any stores accessed within it change.
 */
export function watch<T>(fn: (priorReturn: T) => T): Unsubscriber {
  const s = computed(fn);
  return s.subscribe(noop);
}

/**
 * Create a `ReadonlyStore` that computes its value from other stores and updates when those stores change.
 */
export function computed<T>(fn: (priorValue: T) => T, value?: T): ReadonlyStore<T> {
  let unsubscribes = new Set<Unsubscriber>();

  return readonly(value, set => {
    const subscribers = set[subscribersKey] as Subscribers<T>;
    let pending = 0;
    const subscriber = () => --pending === 0 && sync();
    const invalidate = () => {
      pending++;
      // Ensure computed stores that have multiple overlapping dependencies only trigger once after others
      forExistsInBoth(subscribers, new Map(root.subscriberQueue), subscriber => {
        // move to the end of the queue
        const value = root.subscriberQueue.get(subscriber);
        root.subscriberQueue.delete(subscriber);
        root.subscriberQueue.set(subscriber, value);
      });
    };

    const sync = () => {
      const prior = root.context;

      // Set the context for the computed function
      root.context = { subscriber, invalidate, unsubscribes: new Set() };

      try {
        // Run the function, collecting subscriptions from any stores accessed during execution
        value = fn(value);
        if (value instanceof Promise) {
          throw new Error(
            'computed() should not be used with async methods (it won\'t update when dependent stores change).'
          );
        }
      } finally {
        // Filter out unchanged unsubscribes, leaving only those which no longer apply
        root.context.unsubscribes.forEach(u => unsubscribes.delete(u));

        // Unsubscribe from all the stores that are no longer needed
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
 * Provides a promise that resolves when the store is no longer `null` or `undefined`.
 */
export function whenReady<T>(store: ReadonlyStore<T>): Promise<T> {
  return whenMatches(store, v => v != null) as Promise<T>;
}

/**
 * Provides a promise that resolves when the store's value meets the provided condition.
 */
export function whenMatches<T>(store: ReadonlyStore<T>, matches: (value: T) => boolean): Promise<T> {
  return new Promise(resolve => {
    const unsubscribe = store.subscribe(value => {
      if (!matches(value)) return;
      unsubscribe();
      resolve(value);
    });
  });
}

/**
 * Provides a promise that resolves after the store changes and returns the new value.
 */
export function afterChange<T>(store: ReadonlyStore<T>): Promise<T> {
  return new Promise(resolve => {
    const unsubscribe = store.subscribe(value => {
      unsubscribe();
      resolve(value);
    }, false);
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
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  smaller.forEach((_, key) => larger.has(key) && fn(key));
}
