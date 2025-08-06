import * as SDK from "azure-devops-extension-sdk";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { CommonServiceIds, IProjectPageService, getClient } from "azure-devops-extension-api";

import { TimeEntryType, WorkLocation } from './domain/models/TimeEntry';
import { TimeEntryDomainService } from './domain/services/TimeEntryService';
import { CrmIntegrationService, CrmConfiguration } from './infrastructure/crm/CrmIntegrationService';
import { TimeEntryValidationService } from './infrastructure/validation/TimeEntryValidationService';
import { InMemoryTimeEntryRepository } from './infrastructure/repositories/InMemoryTimeEntryRepository';

class TimeEntryTabController {
    private domainService!: TimeEntryDomainService;
    private crmService!: CrmIntegrationService;
    private validationService!: TimeEntryValidationService;
    private repository!: InMemoryTimeEntryRepository;
    private currentWorkItem: any;
    private currentUser: any;

    constructor() {
        this.initializeServices();
        this.setupEventListeners();
    }

    private initializeServices(): void {
        // Initialize CRM configuration - these should come from extension settings
        const crmConfig: CrmConfiguration = {
            baseUrl: this.getCrmBaseUrl(),
            clientId: this.getCrmClientId(),
            clientSecret: this.getCrmClientSecret(),
            tenantId: this.getCrmTenantId(),
            resource: this.getCrmResource()
        };

        this.crmService = new CrmIntegrationService(crmConfig);
        this.validationService = new TimeEntryValidationService();
        this.repository = new InMemoryTimeEntryRepository();
        
        this.domainService = new TimeEntryDomainService(
            this.repository,
            this.validationService,
            this.crmService
        );
    }

    private setupEventListeners(): void {
        const form = document.getElementById('timeEntryForm') as HTMLFormElement;
        const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
        const projectSelect = document.getElementById('project') as HTMLSelectElement;

        form.addEventListener('submit', this.handleSubmit.bind(this));
        resetBtn.addEventListener('click', this.handleReset.bind(this));
        projectSelect.addEventListener('change', this.handleProjectChange.bind(this));

        // Real-time validation
        this.setupRealTimeValidation();
    }

    private setupRealTimeValidation(): void {
        const fields = ['date', 'duration', 'type', 'workLocation', 'description'];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId) as HTMLInputElement;
            if (field) {
                field.addEventListener('blur', () => this.validateField(fieldId));
                field.addEventListener('input', () => this.clearValidationMessage(fieldId));
            }
        });
    }

    private async validateField(fieldId: string): Promise<void> {
        const field = document.getElementById(fieldId) as HTMLInputElement;
        const validationDiv = document.getElementById(`${fieldId}Validation`) as HTMLDivElement;
        
        if (!field || !validationDiv) return;

        let isValid = true;
        let message = '';
        let messageType = 'error';

        switch (fieldId) {
            case 'date':
                const selectedDate = new Date(field.value);
                const today = new Date();
                
                if (selectedDate > today) {
                    isValid = false;
                    message = 'Tarih gelecek bir tarih olamaz.';
                } else if (selectedDate < new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)) {
                    messageType = 'warning';
                    message = 'Tarih 30 günden daha eski. Onay gerekebilir.';
                }
                break;

            case 'duration':
                const duration = parseFloat(field.value);
                if (duration > 12) {
                    messageType = 'warning';
                    message = '12 saatten fazla çalışma süresi. Onay gerekebilir.';
                }
                break;

            case 'description':
                if (field.value.trim().length < 10) {
                    messageType = 'warning';
                    message = 'Açıklama daha detaylı olabilir.';
                }
                break;
        }

        this.showValidationMessage(validationDiv, message, messageType, isValid);
    }

    private showValidationMessage(element: HTMLElement, message: string, type: string, _isValid: boolean): void {
        if (message) {
            element.textContent = message;
            element.className = `validation-message validation-${type}`;
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }

    private clearValidationMessage(fieldId: string): void {
        const validationDiv = document.getElementById(`${fieldId}Validation`) as HTMLDivElement;
        if (validationDiv) {
            validationDiv.style.display = 'none';
        }
    }

    private async handleSubmit(event: Event): Promise<void> {
        event.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
        const loadingSpinner = document.getElementById('loadingSpinner') as HTMLDivElement;
        const successMessage = document.getElementById('successMessage') as HTMLDivElement;
        const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;

        try {
            // Show loading state
            submitBtn.disabled = true;
            loadingSpinner.classList.add('active');
            successMessage.classList.remove('active');
            errorMessage.classList.remove('active');

            // Collect form data
            const formData = this.collectFormData();
            
            // Validate form data
            if (!this.validateFormData(formData)) {
                return;
            }

            // Create time entry domain object
            const timeEntry = await this.domainService.createTimeEntry(formData);

            // Submit to CRM
            const result = await this.domainService.submitTimeEntry(timeEntry);

            if (result.success) {
                successMessage.classList.add('active');
                this.resetForm();
                
                // Optionally update work item with reference to time entry
                if (result.crmRecordId) {
                    await this.updateWorkItemWithTimeEntry(result.crmRecordId);
                }
            } else {
                this.showError(result.errorMessage || 'Bilinmeyen hata oluştu');
            }

        } catch (error) {
            console.error('Zaman girişi gönderme hatası:', error);
            this.showError('Beklenmeyen hata: ' + (error as Error).message);
        } finally {
            submitBtn.disabled = false;
            loadingSpinner.classList.remove('active');
        }
    }

    private collectFormData(): any {
        const form = document.getElementById('timeEntryForm') as HTMLFormElement;
        const formData = new FormData(form);
        
        return {
            date: formData.get('date') as string,
            duration: parseFloat(formData.get('duration') as string),
            type: parseInt(formData.get('type') as string) as TimeEntryType,
            workLocation: parseInt(formData.get('workLocation') as string) as WorkLocation,
            projectId: formData.get('project') as string,
            projectTaskId: formData.get('projectTask') as string,
            description: formData.get('description') as string,
            billable: formData.get('billable') === 'on',
            bookableResourceId: formData.get('bookableResource') as string,
            ownerId: this.currentUser?.id || '',
            serviceRequestId: formData.get('serviceRequest') as string || undefined,
            resourceCategoryId: formData.get('resourceCategory') as string || undefined,
            additionalDescription: formData.get('additionalDescription') as string || undefined
        };
    }

    private validateFormData(formData: any): boolean {
        let isValid = true;
        
        // Clear previous validation messages
        document.querySelectorAll('.validation-message').forEach(el => {
            (el as HTMLElement).style.display = 'none';
        });

        // Required field validation
        const requiredFields = [
            { field: 'date', message: 'Tarih alanı zorunludur' },
            { field: 'duration', message: 'Süre alanı zorunludur' },
            { field: 'type', message: 'Tür alanı zorunludur' },
            { field: 'workLocation', message: 'Çalışma yeri alanı zorunludur' },
            { field: 'projectId', message: 'Proje alanı zorunludur' },
            { field: 'projectTaskId', message: 'Proje görevi alanı zorunludur' },
            { field: 'description', message: 'Açıklama alanı zorunludur' },
            { field: 'bookableResourceId', message: 'Ayrılabilir kaynak alanı zorunludur' }
        ];

        requiredFields.forEach(({ field, message }) => {
            const value = formData[field];
            if (!value || (typeof value === 'string' && !value.trim())) {
                const validationDiv = document.getElementById(`${field}Validation`) || 
                                    document.getElementById(`${field.replace('Id', '')}Validation`);
                if (validationDiv) {
                    this.showValidationMessage(validationDiv, message, 'error', false);
                }
                isValid = false;
            }
        });

        return isValid;
    }

    private async handleProjectChange(): Promise<void> {
        const projectSelect = document.getElementById('project') as HTMLSelectElement;
        const taskSelect = document.getElementById('projectTask') as HTMLSelectElement;
        
        const projectId = projectSelect.value;
        
        // Clear and disable task select
        taskSelect.innerHTML = '<option value="">Görev yükleniyor...</option>';
        taskSelect.disabled = true;

        if (projectId) {
            try {
                const tasks = await this.crmService.getProjectTasks(projectId);
                
                taskSelect.innerHTML = '<option value="">Görev seçiniz...</option>';
                tasks.forEach(task => {
                    const option = document.createElement('option');
                    option.value = task.id;
                    option.textContent = task.name;
                    taskSelect.appendChild(option);
                });
                
                taskSelect.disabled = false;
            } catch (error) {
                console.error('Proje görevleri yüklenirken hata:', error);
                taskSelect.innerHTML = '<option value="">Görev yüklenemedi</option>';
            }
        } else {
            taskSelect.innerHTML = '<option value="">Önce proje seçiniz...</option>';
        }
    }

    private handleReset(): void {
        this.resetForm();
    }

    private resetForm(): void {
        const form = document.getElementById('timeEntryForm') as HTMLFormElement;
        form.reset();
        
        // Clear validation messages
        document.querySelectorAll('.validation-message').forEach(el => {
            (el as HTMLElement).style.display = 'none';
        });
        
        // Reset project task select
        const taskSelect = document.getElementById('projectTask') as HTMLSelectElement;
        taskSelect.innerHTML = '<option value="">Önce proje seçiniz...</option>';
        taskSelect.disabled = true;

        // Set default date to today
        const dateInput = document.getElementById('date') as HTMLInputElement;
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    private showError(message: string): void {
        const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
        const errorText = document.getElementById('errorText') as HTMLSpanElement;
        
        errorText.textContent = message;
        errorMessage.classList.add('active');
    }

    private async loadLookupData(): Promise<void> {
        try {
            // Load projects
            const projects = await this.crmService.getProjects();
            const projectSelect = document.getElementById('project') as HTMLSelectElement;
            
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                projectSelect.appendChild(option);
            });

            // Load bookable resources
            const resources = await this.crmService.getBookableResources();
            const resourceSelect = document.getElementById('bookableResource') as HTMLSelectElement;
            
            resources.forEach(resource => {
                const option = document.createElement('option');
                option.value = resource.id;
                option.textContent = resource.name;
                resourceSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Lookup veriler yüklenirken hata:', error);
        }
    }

    private async updateWorkItemWithTimeEntry(crmRecordId: string): Promise<void> {
        try {
            if (!this.currentWorkItem) return;

            const client = getClient(WorkItemTrackingRestClient);
            const workItemId = this.currentWorkItem.id;

            // Add a comment or custom field to link the time entry
            const patchDocument = [
                {
                    op: "add",
                    path: "/fields/System.History",
                    value: `CRM zaman girişi oluşturuldu. Kayıt ID: ${crmRecordId}`
                }
            ];

            await client.updateWorkItem(patchDocument, workItemId);
        } catch (error) {
            console.error('Work item güncellenirken hata:', error);
        }
    }

    // Configuration methods - these should be implemented based on your setup
    private getCrmBaseUrl(): string {
        return SDK.getConfiguration()?.crmBaseUrl || 'https://your-org.crm.dynamics.com';
    }

    private getCrmClientId(): string {
        return SDK.getConfiguration()?.crmClientId || '';
    }

    private getCrmClientSecret(): string {
        return SDK.getConfiguration()?.crmClientSecret || '';
    }

    private getCrmTenantId(): string {
        return SDK.getConfiguration()?.crmTenantId || '';
    }

    private getCrmResource(): string {
        return SDK.getConfiguration()?.crmResource || 'https://your-org.crm.dynamics.com';
    }

    public async initialize(): Promise<void> {
        try {
            await SDK.init();
            
            // Get current work item
            const workItemService = await SDK.getService("ms.vss-work-web.work-item-form-service") as any;
            this.currentWorkItem = await workItemService.getId();

            // Get current user
            const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
            await projectService.getProject();
            // Note: You'll need to implement user service to get current user

            // Load lookup data
            await this.loadLookupData();

            // Set default values
            this.resetForm();

        } catch (error) {
            console.error('Extension başlatılırken hata:', error);
        }
    }
}

// Initialize the extension when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const controller = new TimeEntryTabController();
    await controller.initialize();
});
