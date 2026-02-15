export {};

declare global {
    interface Window {
        configs?: {
            apiUrl: string;
        };
    }
}