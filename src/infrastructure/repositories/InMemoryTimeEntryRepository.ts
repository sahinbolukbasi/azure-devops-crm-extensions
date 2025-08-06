import { TimeEntry, TimeEntryId } from '../../domain/models/TimeEntry';
import { ITimeEntryRepository } from '../../domain/services/TimeEntryService';

export class InMemoryTimeEntryRepository implements ITimeEntryRepository {
    private timeEntries: Map<string, TimeEntry> = new Map();

    async save(timeEntry: TimeEntry): Promise<void> {
        this.timeEntries.set(timeEntry.id.value, timeEntry);
    }

    async findById(id: TimeEntryId): Promise<TimeEntry | null> {
        return this.timeEntries.get(id.value) || null;
    }

    async findByDateRange(startDate: Date, endDate: Date): Promise<TimeEntry[]> {
        const entries: TimeEntry[] = [];
        
        for (const timeEntry of this.timeEntries.values()) {
            if (timeEntry.date >= startDate && timeEntry.date <= endDate) {
                entries.push(timeEntry);
            }
        }
        
        return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    async findByProject(projectId: string): Promise<TimeEntry[]> {
        const entries: TimeEntry[] = [];
        
        for (const timeEntry of this.timeEntries.values()) {
            if (timeEntry.projectId.value === projectId) {
                entries.push(timeEntry);
            }
        }
        
        return entries;
    }

    async findByUser(userId: string): Promise<TimeEntry[]> {
        const entries: TimeEntry[] = [];
        
        for (const timeEntry of this.timeEntries.values()) {
            if (timeEntry.ownerId.value === userId) {
                entries.push(timeEntry);
            }
        }
        
        return entries;
    }

    async delete(id: TimeEntryId): Promise<void> {
        this.timeEntries.delete(id.value);
    }

    async clear(): Promise<void> {
        this.timeEntries.clear();
    }

    async getAll(): Promise<TimeEntry[]> {
        return Array.from(this.timeEntries.values());
    }
}
