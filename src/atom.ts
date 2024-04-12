import type { Subscriber, Unsubscriber } from './types';
export type Invalidator = () => void;
export type StartStopNotifier<T> = (set: Atom<T>) => Unsubscriber | void;
export type { Subscriber, Unsubscriber };

export interface Derived<T> {
  /**
   * Return the current value.
   */
  (): T;

  /**
   * Subscribe to changes with a callback. Returns an unsubscribe function.
   */
  subscribe(callback: Subscriber<T>): Unsubscriber;
}

export interface Atom<T> extends Derived<T> {
  /**
   * Set the value and inform subscribers.
   */
  (value: T): void;

  /**
   * @deprecated use atom(value) instead, kept for Svelte 3 compatibility (e.g. $store = value)
   */
  set(value: T): void;
}

type Dependencies = Set<Derived<any>>;
type Context = {
  subscriber: Subscriber<any>;
  invalidate: Invalidator;
  unsubscribes: Set<Unsubscriber>;
};
type Root = {
  context: Context;
  subscriberQueue: Map<Subscriber<any>, any>;
};

const noop = () => {};
// Ensure 2 versions of the signal library can work together
const symbol = Symbol.for('reactiveAtoms');
const root: Root =
  globalThis[symbol] ||
  (globalThis[symbol] = {
    context: null,
    subscriberQueue: new Map(),
  });

/**
 * Creates a `Readable` atom that allows reading by subscription.
 */
export function readable<T>(value?: T, start?: StartStopNotifier<T>): Derived<T> {
  const core = atom(value, start);
  const readable = () => core();
  return Object.assign(readable, { subscribe: core.subscribe });
}

/**
 * Create a `Writable` atom that allows both updating and reading by subscription.
 */
export function atom<T>(value: T, start: StartStopNotifier<T> = noop): Atom<T> {
  let stop: Unsubscriber;
  let started = false;
  const subscribers = new Map<Subscriber<T>, [Unsubscriber, Invalidator?]>();

  function atom(): T;
  function atom(newValue: T): void;
  function atom(newValue?: T): T | void {
    if (newValue === undefined) {
      if (root.context) {
        const { subscriber, unsubscribes, invalidate } = root.context;
        const unsubscribe = subscribe(subscriber, invalidate);
        unsubscribes.add(unsubscribe);
      }

      if (!subscribers.size && !started) {
        started = true;
        try {
          (start(atom as Atom<T>) || noop)();
        } finally {
          started = false;
        }
      }

      return value;
    } else if (value !== newValue) {
      value = newValue;
      if (stop) {
        // atom is ready
        const runQueue = !root.subscriberQueue.size;

        subscribers.forEach(([, invalidate], subscriber) => {
          if (!root.subscriberQueue.has(subscriber)) {
            if (invalidate) invalidate();
          } else {
            // move to the end of the queue
            root.subscriberQueue.delete(subscriber);
          }
          root.subscriberQueue.set(subscriber, value);
        });

        if (runQueue) {
          const iter = root.subscriberQueue.entries();
          while (root.subscriberQueue.size > 0) {
            const [subscriber, value] = iter.next().value;
            root.subscriberQueue.delete(subscriber);
            subscriber(value);
          }
        }
      }
    }
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
      stop = start(atom as Atom<T>) || noop;
    }

    // If invalidate is provided, this comes from a derived atom and we should not call the subscriber immediately
    if (!invalidate) {
      subscriber(value);
    }

    return unsubscribe;
  }

  return Object.assign(atom, { subscribe, set: (value: T) => atom(value) });
}

/**
 * Observe atoms and derived values by synchronizing one or more readable atoms within an aggregation function.
 */
export function observe<T>(fn: () => T): Unsubscriber {
  return derived(fn).subscribe(noop);
}

/**
 * Create a `Readable` atom that derives its value from other atoms and updates when those atoms change.
 */
export function derived<T>(fn: (priorValue: T) => T, value?: T): Derived<T> {
  let unsubscribes = new Set<Unsubscriber>();

  return readable(value, set => {
    let pending = 0;
    const subscriber = () => --pending === 0 && sync();
    const invalidate = () => pending++;

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
