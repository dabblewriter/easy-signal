
export type Unsubscriber = () => void;
export type Subscriber<T> = (value: T) => void;