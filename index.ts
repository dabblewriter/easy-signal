type Args<T> = T extends (...args: infer A) => any ? A : never;
export type Subscriber = (...args: any[]) => any;
export type Unsubscriber = () => boolean;

export type Signal<T extends Subscriber = Subscriber> = {
  (listener: T): Unsubscriber;
  dispatch: (...args: Args<T>) => void;
}

export function signal<T extends Subscriber = Subscriber>(): Signal<T> {
  const listeners = new Set<T>();

  function subscribe(listener: T) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  subscribe.dispatch = (...args: Args<T>) => listeners.forEach(listener => listener(...args));
  subscribe.clear = listeners.clear.bind(listeners);

  return subscribe;
}
