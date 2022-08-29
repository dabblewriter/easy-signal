declare type Args<T> = T extends (...args: infer A) => any ? A : never;
export declare type Signal<T extends (...args: any[]) => any = (...args: any[]) => any> = {
    (listener: T): () => boolean;
    dispatch: (...args: Args<T>) => void;
};
export declare function signal<T extends (...args: any[]) => any>(): Signal<T>;
export {};
