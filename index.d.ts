declare type Args<T> = T extends (...args: infer A) => any ? A : never;
export declare type Subscriber = (...args: any[]) => any;
export declare type Unsubscriber = () => boolean;
export declare type Signal<T extends Subscriber = Subscriber> = {
    (listener: T): Unsubscriber;
    dispatch: (...args: Args<T>) => void;
    error?: Signal<(err: Error) => any>;
};
export declare function signal<T extends Subscriber = Subscriber>(): Signal<T>;
export {};
