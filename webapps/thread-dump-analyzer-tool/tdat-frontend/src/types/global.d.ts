export {};

declare global {
    interface Window {
        configs?: {
            apiUrl: string;
            ASGARDEO_CLIENT_ID: string;
            ASGARDEO_BASE_URL: string;
        };
    }
}