import { TimeEntry } from '../../domain/models/TimeEntry';
import { ITimeEntryValidationService, ValidationResult } from '../../domain/services/TimeEntryService';

export class TimeEntryValidationService implements ITimeEntryValidationService {
  async validateTimeEntry(timeEntry: TimeEntry): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Business rule validations
      await this.validateBusinessRules(timeEntry, errors, warnings);
      
      // Data integrity validations
      await this.validateDataIntegrity(timeEntry, errors, warnings);
      
      // CRM specific validations
      await this.validateCrmConstraints(timeEntry, errors, warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(`Doğrulama sırasında hata: ${(error as Error).message}`);
      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  private async validateBusinessRules(timeEntry: TimeEntry, errors: string[], _warnings: string[]): Promise<void> {
    // Date validations
    const today = new Date();
    const maxPastDays = 30; // Maximum 30 days in the past
    const minDate = new Date(today.getTime() - (maxPastDays * 24 * 60 * 60 * 1000));
    
    if (timeEntry.date < minDate) {
      _warnings.push(`Tarih ${maxPastDays} günden daha eski. Onay gerekebilir.`);
    }

    // Weekend work validation
    const dayOfWeek = timeEntry.date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      _warnings.push('Hafta sonu çalışması giriliyor. Onay gerekebilir.');
    }

    // Duration validations
    if (timeEntry.duration > 12) {
      _warnings.push('12 saatten fazla çalışma süresi. Onay gerekebilir.');
    }

    if (timeEntry.duration < 0.25) {
      errors.push('Minimum çalışma süresi 15 dakikadır.');
    }

    // Description quality check
    if (timeEntry.description.length < 10) {
      _warnings.push('Açıklama çok kısa. Daha detaylı açıklama önerilir.');
    }

    // Check for common description patterns that might indicate low quality
    const lowQualityPatterns = [
      /^(çalışma|iş|görev|proje)$/i,
      /^.{1,5}$/,
      /^(test|deneme|aa+|xx+)$/i
    ];

    if (lowQualityPatterns.some(pattern => pattern.test(timeEntry.description.trim()))) {
      _warnings.push('Açıklama daha açıklayıcı olabilir.');
    }
  }

  private async validateDataIntegrity(timeEntry: TimeEntry, errors: string[], _warnings: string[]): Promise<void> {
    // GUID format validation for lookup fields
    const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!guidPattern.test(timeEntry.projectId.value)) {
      errors.push('Proje ID geçerli bir GUID formatında değil.');
    }

    if (!guidPattern.test(timeEntry.projectTaskId.value)) {
      errors.push('Proje görev ID geçerli bir GUID formatında değil.');
    }

    if (!guidPattern.test(timeEntry.bookableResourceId.value)) {
      errors.push('Ayrılabilir kaynak ID geçerli bir GUID formatında değil.');
    }

    if (!guidPattern.test(timeEntry.ownerId.value)) {
      errors.push('Sahip ID geçerli bir GUID formatında değil.');
    }

    if (timeEntry.serviceRequestId && !guidPattern.test(timeEntry.serviceRequestId.value)) {
      errors.push('Servis talebi ID geçerli bir GUID formatında değil.');
    }

    if (timeEntry.resourceCategoryId && !guidPattern.test(timeEntry.resourceCategoryId.value)) {
      errors.push('Kaynak kategori ID geçerli bir GUID formatında değil.');
    }

    // Text length validations
    if (timeEntry.description.length > 2000) {
      errors.push('Açıklama 2000 karakterden fazla olamaz.');
    }

    if (timeEntry.additionalDescription && timeEntry.additionalDescription.length > 4000) {
      errors.push('Ek açıklama 4000 karakterden fazla olamaz.');
    }
  }

  private async validateCrmConstraints(timeEntry: TimeEntry, errors: string[], warnings: string[]): Promise<void> {
    // Validate enum values
    const validTimeEntryTypes = [192350000, 192350001, 192350002, 192350003];
    if (!validTimeEntryTypes.includes(timeEntry.type)) {
      errors.push('Geçersiz zaman girişi türü.');
    }

    const validWorkLocations = [100000000, 100000001, 100000002, 100000003];
    if (!validWorkLocations.includes(timeEntry.workLocation)) {
      errors.push('Geçersiz çalışma yeri.');
    }

    const validDurations = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    if (!validDurations.includes(timeEntry.duration)) {
      errors.push('Geçersiz süre değeri. Sadece önceden tanımlanmış değerler kullanılabilir.');
    }

    // Business logic constraints
    if (timeEntry.billable && timeEntry.serviceRequestId) {
      // If it's billable and has a service request, additional validation might be needed
      warnings.push('Faturalanabilir servis talebi girişi. Müşteri onayı gerekebilir.');
    }

    // Project and task relationship validation would require CRM lookup
    // This could be implemented as an async validation if needed
    warnings.push('Proje ve görev ilişkisi CRM\'de doğrulanacak.');
  }

  // Helper method for custom validation rules
  public addCustomValidation(timeEntry: TimeEntry, customRules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of customRules) {
      const result = rule.validate(timeEntry);
      if (!result.isValid) {
        if (result.severity === 'error') {
          errors.push(result.message);
        } else {
          warnings.push(result.message);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export interface ValidationRule {
  name: string;
  validate(timeEntry: TimeEntry): ValidationRuleResult;
}

export interface ValidationRuleResult {
  isValid: boolean;
  message: string;
  severity: 'error' | 'warning';
}

// Example custom validation rules
export class WeekendWorkValidationRule implements ValidationRule {
  name = 'WeekendWorkValidation';

  validate(timeEntry: TimeEntry): ValidationRuleResult {
    const dayOfWeek = timeEntry.date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      isValid: !isWeekend,
      message: 'Hafta sonu çalışması için özel onay gerekiyor.',
      severity: 'warning'
    };
  }
}

export class MaxDailyHoursValidationRule implements ValidationRule {
  constructor(private maxHours: number = 12) {}

  name = 'MaxDailyHoursValidation';

  validate(timeEntry: TimeEntry): ValidationRuleResult {
    const exceedsLimit = timeEntry.duration > this.maxHours;

    return {
      isValid: !exceedsLimit,
      message: `Günlük maksimum ${this.maxHours} saat çalışma süresi aşıldı.`,
      severity: 'error'
    };
  }
}
