type Args<T> = T extends (...args: infer A) => any ? A : never;

export type Signal<T extends (...args: any[]) => any = (...args: any[]) => any> = {
  (listener: T): () => boolean;
  dispatch: (...args: Args<T>) => void;
}

export function signal<T extends (...args: any[]) => any>(): Signal<T> {
  const listeners = new Set<T>();

  function subscribe(listener: T) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  subscribe.dispatch = (...args: Args<T>) => listeners.forEach(listener => listener(...args));
  subscribe.clear = listeners.clear.bind(listeners);

  return subscribe;
}
