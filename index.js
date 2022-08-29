export function signal() {
    const listeners = new Set();
    function subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
    subscribe.dispatch = (...args) => listeners.forEach(listener => listener(...args));
    subscribe.clear = listeners.clear.bind(listeners);
    return subscribe;
}
