// Domain Model for Time Entry following DDD principles
export interface TimeEntryId {
  value: string;
}

export interface ProjectId {
  value: string;
}

export interface ProjectTaskId {
  value: string;
}

export interface BookableResourceId {
  value: string;
}

export interface ResourceCategoryId {
  value: string;
}

export interface ServiceRequestId {
  value: string;
}

export interface OwnerId {
  value: string;
}

export enum TimeEntryType {
  WORK = 192350000,
  ABSENCE = 192350001,
  VACATION = 192350002,
  BREAK = 192350003
}

export enum WorkLocation {
  OFFICE = 100000000,
  HOME = 100000001,
  CLIENT_SITE = 100000002,
  FIELD = 100000003
}

export enum DurationOption {
  FIFTEEN_MINUTES = 0.25,
  THIRTY_MINUTES = 0.5,
  FORTY_FIVE_MINUTES = 0.75,
  ONE_HOUR = 1.0,
  ONE_HOUR_FIFTEEN = 1.25,
  ONE_HOUR_THIRTY = 1.5,
  ONE_HOUR_FORTY_FIVE = 1.75,
  TWO_HOURS = 2.0,
  THREE_HOURS = 3.0,
  FOUR_HOURS = 4.0,
  FIVE_HOURS = 5.0,
  SIX_HOURS = 6.0,
  SEVEN_HOURS = 7.0,
  EIGHT_HOURS = 8.0
}

export class TimeEntry {
  constructor(
    public readonly id: TimeEntryId,
    public readonly date: Date,
    public readonly duration: DurationOption,
    public readonly type: TimeEntryType,
    public readonly workLocation: WorkLocation,
    public readonly projectId: ProjectId,
    public readonly projectTaskId: ProjectTaskId,
    public readonly description: string,
    public readonly billable: boolean,
    public readonly bookableResourceId: BookableResourceId,
    public readonly ownerId: OwnerId,
    public readonly serviceRequestId?: ServiceRequestId,
    public readonly resourceCategoryId?: ResourceCategoryId,
    public readonly additionalDescription?: string
  ) {
    this.validateRequiredFields();
    this.validateBusinessRules();
  }

  private validateRequiredFields(): void {
    if (!this.date) {
      throw new Error('Tarih alanı zorunludur');
    }
    
    if (!this.duration) {
      throw new Error('Süre alanı zorunludur');
    }
    
    if (!this.type) {
      throw new Error('Tür alanı zorunludur');
    }
    
    if (!this.workLocation) {
      throw new Error('Çalışma yeri alanı zorunludur');
    }
    
    if (!this.projectId?.value) {
      throw new Error('Proje alanı zorunludur');
    }
    
    if (!this.projectTaskId?.value) {
      throw new Error('Proje görevi alanı zorunludur');
    }
    
    if (!this.description?.trim()) {
      throw new Error('Açıklama alanı zorunludur');
    }
    
    if (this.billable === undefined || this.billable === null) {
      throw new Error('Faturalanacak mı alanı zorunludur');
    }
    
    if (!this.bookableResourceId?.value) {
      throw new Error('Ayrılabilir kaynak alanı zorunludur');
    }
    
    if (!this.ownerId?.value) {
      throw new Error('Sahip alanı zorunludur');
    }
  }

  private validateBusinessRules(): void {
    // Date cannot be in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (this.date > today) {
      throw new Error('Tarih gelecek bir tarih olamaz');
    }

    // Duration must be positive
    if (this.duration <= 0) {
      throw new Error('Süre pozitif bir değer olmalıdır');
    }

    // Description must have minimum length
    if (this.description.trim().length < 3) {
      throw new Error('Açıklama en az 3 karakter olmalıdır');
    }

    // Additional description length validation
    if (this.additionalDescription && this.additionalDescription.length > 2000) {
      throw new Error('Ek açıklama 2000 karakterden fazla olamaz');
    }
  }

  public toCrmEntity(): any {
    return {
      msdyn_date: this.date.toISOString().split('T')[0],
      msdyn_duration: this.duration,
      msdyn_type: this.type,
      new_calismayeri: this.workLocation,
      'msdyn_project@odata.bind': `/msdyn_projects(${this.projectId.value})`,
      'msdyn_projecttask@odata.bind': `/msdyn_projecttasks(${this.projectTaskId.value})`,
      msdyn_description: this.description,
      new_fatura: this.billable,
      'msdyn_bookableresource@odata.bind': `/bookableresources(${this.bookableResourceId.value})`,
      'ownerid@odata.bind': `/systemusers(${this.ownerId.value})`,
      ...(this.serviceRequestId && {
        'new_servistalebi@odata.bind': `/incidents(${this.serviceRequestId.value})`
      }),
      ...(this.resourceCategoryId && {
        'msdyn_resourcecategory@odata.bind': `/bookableresourcecategories(${this.resourceCategoryId.value})`
      }),
      ...(this.additionalDescription && {
        new_ekaciklama: this.additionalDescription
      })
    };
  }
}
