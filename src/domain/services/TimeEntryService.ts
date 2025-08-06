import { TimeEntry, TimeEntryId } from '../models/TimeEntry';

// Domain Service Interface following DDD principles
export interface ITimeEntryRepository {
  save(timeEntry: TimeEntry): Promise<void>;
  findById(id: TimeEntryId): Promise<TimeEntry | null>;
  findByDateRange(startDate: Date, endDate: Date): Promise<TimeEntry[]>;
}

export interface ITimeEntryValidationService {
  validateTimeEntry(timeEntry: TimeEntry): Promise<ValidationResult>;
}

export interface ICrmIntegrationService {
  submitTimeEntry(timeEntry: TimeEntry): Promise<CrmSubmissionResult>;
  validateCrmConnection(): Promise<boolean>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CrmSubmissionResult {
  success: boolean;
  crmRecordId?: string | undefined;
  errorMessage?: string;
  errorDetails?: any;
}

// Domain Service Implementation
export class TimeEntryDomainService {
  constructor(
    private readonly timeEntryRepository: ITimeEntryRepository,
    private readonly validationService: ITimeEntryValidationService,
    private readonly crmIntegrationService: ICrmIntegrationService
  ) {}

  async createTimeEntry(timeEntryData: any): Promise<TimeEntry> {
    // Create domain object with validation
    const timeEntry = new TimeEntry(
      { value: this.generateId() },
      new Date(timeEntryData.date),
      timeEntryData.duration,
      timeEntryData.type,
      timeEntryData.workLocation,
      { value: timeEntryData.projectId },
      { value: timeEntryData.projectTaskId },
      timeEntryData.description,
      timeEntryData.billable,
      { value: timeEntryData.bookableResourceId },
      { value: timeEntryData.ownerId },
      timeEntryData.serviceRequestId ? { value: timeEntryData.serviceRequestId } : undefined,
      timeEntryData.resourceCategoryId ? { value: timeEntryData.resourceCategoryId } : undefined,
      timeEntryData.additionalDescription
    );

    return timeEntry;
  }

  async submitTimeEntry(timeEntry: TimeEntry): Promise<CrmSubmissionResult> {
    try {
      // Domain validation
      const validationResult = await this.validationService.validateTimeEntry(timeEntry);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          errorMessage: 'Doğrulama hatası: ' + validationResult.errors.join(', ')
        };
      }

      // Check CRM connection
      const crmConnectionValid = await this.crmIntegrationService.validateCrmConnection();
      if (!crmConnectionValid) {
        return {
          success: false,
          errorMessage: 'CRM bağlantısı kurulamadı'
        };
      }

      // Submit to CRM
      const submissionResult = await this.crmIntegrationService.submitTimeEntry(timeEntry);
      
      if (submissionResult.success) {
        // Save to local repository if needed
        await this.timeEntryRepository.save(timeEntry);
      }

      return submissionResult;
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Beklenmeyen hata: ' + (error as Error).message,
        errorDetails: error
      };
    }
  }

  private generateId(): string {
    return 'te_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
