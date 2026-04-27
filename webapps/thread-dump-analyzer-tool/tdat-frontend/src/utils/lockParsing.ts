export type LockType = 'OBJECT_MONITOR' | 'JUC_LOCK' | 'WAIT_SET';

export interface LockRef {
    address: string;
    className: string;
    lockType: LockType;
}

const LOCK_WAITING_REGEX = /[-\s]waiting to lock\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const LOCK_HOLDING_REGEX = /[-\s]locked\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const PARKING_REGEX = /[-\s]parking to wait for\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;
const WAITING_ON_REGEX = /[-\s]waiting on\s+<(0x[0-9a-fA-F]+)>\s+\(a\s+([^)]+)\)/;

export function findWaitingLock(stackTrace: string[]): LockRef | null {
    for (const line of stackTrace) {
        const waitMatch = line.match(LOCK_WAITING_REGEX);
        if (waitMatch) return { address: waitMatch[1], className: waitMatch[2], lockType: 'OBJECT_MONITOR' };

        const parkMatch = line.match(PARKING_REGEX);
        if (parkMatch) return { address: parkMatch[1], className: parkMatch[2], lockType: 'JUC_LOCK' };

        const waitOnMatch = line.match(WAITING_ON_REGEX);
        if (waitOnMatch) return { address: waitOnMatch[1], className: waitOnMatch[2], lockType: 'WAIT_SET' };
    }
    return null;
}

export function findHeldLocks(stackTrace: string[]): LockRef[] {
    const locks: LockRef[] = [];
    for (const line of stackTrace) {
        const match = line.match(LOCK_HOLDING_REGEX);
        if (match) locks.push({ address: match[1], className: match[2], lockType: 'OBJECT_MONITOR' });
    }
    return locks;
}
