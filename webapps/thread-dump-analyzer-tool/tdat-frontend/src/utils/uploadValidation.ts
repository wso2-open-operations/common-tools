const ALLOWED_EXTENSIONS = ['txt', 'log'];

export interface PairedFile {
    dump: File | null;
    usage: File | null;
    matched: boolean;
    warning?: string;
}

export function validateFiles(files: File[]): { valid: File[]; invalid: boolean } {
    const validFiles: File[] = [];
    let hasInvalid = false;

    files.forEach(file => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension && ALLOWED_EXTENSIONS.includes(extension)) {
            validFiles.push(file);
        } else {
            hasInvalid = true;
        }
    });

    return { valid: validFiles, invalid: hasInvalid };
}

export function extractFileKey(filename: string): string {
    let key = filename.replace(/\.[^/.]+$/, '');

    const prefixes = [
        'threaddump', 'threadusage', 'thread_dump', 'thread_usage',
        'thread-dump', 'thread-usage', 'dump', 'usage', 'td', 'tu',
    ];

    const lowerKey = key.toLowerCase();
    for (const prefix of prefixes) {
        if (lowerKey.startsWith(prefix)) {
            key = key.substring(prefix.length);
            key = key.replace(/^[_\-.]/, '');
            break;
        }
    }

    return key.trim().toLowerCase();
}
