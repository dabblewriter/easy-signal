type Scheduler = (callback: () => void) => void;

function debounce<T extends (...args: any[]) => void>(scheduler: Scheduler, fn: T): T {
  let nextArgs: any[];

  return ((...args: any[]) => {
    if (!nextArgs) {
      scheduler(() => {
        const args = nextArgs;
        nextArgs = null;
        fn(...args);
      });
    }
    nextArgs = args;
  }) as T;
}

/**
 * A function to debounce the execution of a function until the next microtask.
 */
export function onTick<T extends (...args: any[]) => void>(fn: T): T {
  return debounce(callback => queueMicrotask(callback), fn);
}

/**
 * A function to debounce the execution of a function until the next setTimeout.
 */
export function onTimeout<T extends (...args: any[]) => void>(fn: T, delay?: number): T {
  return debounce(callback => setTimeout(callback, delay), fn);
}

/**
 * A function to debounce the execution of a function until the next animation frame.
 */
export function onAnimationFrame<T extends (...args: any[]) => void>(fn: T): T {
  return debounce(callback => requestAnimationFrame(callback), fn);
}
