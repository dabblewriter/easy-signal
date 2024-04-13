type Scheduler = (callback: () => void, ...args: any[]) => void;

function debounce<T extends (...args: any[]) => void>(scheduler: Scheduler, fn: T, ...args: any[]): T {
  let nextArgs: any[];

  return ((...args: any[]) => {
    nextArgs = args;
    if (!nextArgs) {
      scheduler(() => {
        const args = nextArgs;
        nextArgs = null;
        fn(...args);
      }, ...args);
    }
    nextArgs = args;
  }) as T;
}

const tick: Scheduler = (callback) => Promise.resolve().then(callback);
const timeout: Scheduler = (callback) => setTimeout(callback);
const frame: Scheduler = (callback) => requestAnimationFrame(callback);

/**
 * A function to debounce the execution of a function until the next microtask.
 */
export function onTick<T extends (...args: any[]) => void>(fn: T): T {
  return debounce(tick, fn);
}

/**
 * A function to debounce the execution of a function until the next setTimeout(..., 0).
 */
export function onTimeout<T extends (...args: any[]) => void>(fn: T, delay?: number): T {
    return debounce(timeout, fn, delay);
}

/**
 * A function to debounce the execution of a function until the next animation frame.
 */
export function onAnimationFrame<T extends (...args: any[]) => void>(fn: T): T {
  return debounce(frame, fn);
}
