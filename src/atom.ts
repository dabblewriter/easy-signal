import type { Subscriber, Unsubscriber } from './types';
export type Invalidator<T> = (value?: T) => void;
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
  subscribe(callback: Subscriber<T>, invalidate?: Invalidator<T>): Unsubscriber;
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

const noop = () => {};
// Ensure 2 versions of the signal library can work together
const symbol = Symbol.for('reactiveAtoms');
const root =
  globalThis[symbol] ||
  (globalThis[symbol] = {
    context: null,
    subscriberQueue: new Map(),
    trackingDependencies: null,
  } as {
    subscriberQueue: Map<Subscriber<any>, any>;
    trackingDependencies: Dependencies;
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
  const subscribers = new Map<Subscriber<T>, Invalidator<T>>();

  function atom(): T;
  function atom(newValue: T): void;
  function atom(newValue?: T): T | void {
    if (newValue === undefined) {
      if (!subscribers.size && !started) {
        started = true;
        try {
          (start(atom as Atom<T>) || noop)();
        } finally {
          started = false;
        }
      }
      if (root.trackingDependencies) {
        root.trackingDependencies.add(atom as Derived<any>);
      }
      return value;
    } else if (value !== newValue) {
      value = newValue;
      if (stop) {
        // atom is ready
        const runQueue = !root.subscriberQueue.size;

        subscribers.forEach((invalidate, subscriber) => {
          if (!root.subscriberQueue.has(subscriber)) {
            invalidate();
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

  function subscribe(subscriber: Subscriber<T>, invalidate: Invalidator<T> = noop): Unsubscriber {
    subscribers.set(subscriber, invalidate);
    if (subscribers.size === 1) {
      stop = start(atom as Atom<T>) || noop;
    }
    invalidate();
    subscriber(value);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        stop();
        stop = null;
      }
    };
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
export function derived<T>(fn: () => T, initialValue?: T): Derived<T> {
  const dependencies = new Map<Derived<any>, Unsubscriber>();

  return readable(initialValue, set => {
    let inited = false;
    let pending = 0;
    const subscriber = () => --pending === 0 && inited && sync();
    const invalidate = () => pending++;

    const sync = () => {
      const [oldDeps, newDeps] = trackDependencies(new Set(dependencies.keys()), () => {
        const result = fn();
        set(result as T);
      });

      oldDeps.forEach(dep => {
        dependencies.get(dep)();
        dependencies.delete(dep);
      });

      inited = false;
      newDeps.forEach(atom => {
        const unsubscribe = atom.subscribe(subscriber, invalidate);
        dependencies.set(atom, unsubscribe);
      });
      inited = true;
    };

    sync();

    return function stop() {
      dependencies.forEach(unsub => unsub());
      dependencies.clear();
    };
  });
}

function trackDependencies(existing: Dependencies, fn: () => void): [Dependencies, Dependencies] {
  const priorDependencies = root.trackingDependencies;
  const newDeps = (root.trackingDependencies = new Set<Derived<any>>());

  try {
    fn();
  } finally {
    root.trackingDependencies = priorDependencies;

    const oldDeps = new Set(existing);
    newDeps.forEach(oldDeps.delete, oldDeps);
    existing.forEach(newDeps.delete, newDeps);
    return [oldDeps, newDeps];
  }
}
