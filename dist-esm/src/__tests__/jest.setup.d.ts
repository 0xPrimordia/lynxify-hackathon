import '@testing-library/jest-dom';
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeInTheDocument(): R;
            toHaveAttribute(attr: string, value?: string): R;
        }
    }
}
declare global {
    namespace jest {
        interface Expect {
            objectContaining<T>(obj: Partial<T>): T;
            stringContaining(str: string): string;
            stringMatching(str: string): string;
        }
    }
}
declare global {
    namespace jest {
        interface Matchers<R> {
            toHaveBeenCalled(): R;
            toHaveBeenCalledWith(...args: any[]): R;
            toHaveBeenCalledTimes(count: number): R;
            toBe(expected: any): R;
            toEqual(expected: any): R;
            not: Matchers<R>;
        }
    }
}
