/** Unsubscribes from value updates. */
export type Unsubscriber = () => void;

/** Callback to inform of a value updates. */
export type Subscriber<T> = (value: T) => void;
