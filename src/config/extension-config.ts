export interface ExtensionConfiguration {
    crm: {
        baseUrl: string;
        clientId: string;
        clientSecret: string;
        tenantId: string;
        resource: string;
    };
    validation: {
        maxDailyHours: number;
        maxPastDays: number;
        enableWeekendWarning: boolean;
        minDescriptionLength: number;
    };
    ui: {
        defaultWorkLocation: number;
        defaultTimeEntryType: number;
        enableRealTimeValidation: boolean;
    };
}

export const defaultConfiguration: ExtensionConfiguration = {
    crm: {
        baseUrl: process.env.CRM_BASE_URL || 'https://your-org.crm.dynamics.com',
        clientId: process.env.CRM_CLIENT_ID || '',
        clientSecret: process.env.CRM_CLIENT_SECRET || '',
        tenantId: process.env.CRM_TENANT_ID || '',
        resource: process.env.CRM_RESOURCE || 'https://your-org.crm.dynamics.com'
    },
    validation: {
        maxDailyHours: 12,
        maxPastDays: 30,
        enableWeekendWarning: true,
        minDescriptionLength: 10
    },
    ui: {
        defaultWorkLocation: 100000000, // Office
        defaultTimeEntryType: 192350000, // Work
        enableRealTimeValidation: true
    }
};

export class ConfigurationService {
    private static instance: ConfigurationService;
    private config: ExtensionConfiguration;

    private constructor() {
        this.config = { ...defaultConfiguration };
    }

    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    public getConfiguration(): ExtensionConfiguration {
        return this.config;
    }

    public updateConfiguration(updates: Partial<ExtensionConfiguration>): void {
        this.config = { ...this.config, ...updates };
    }

    public getCrmConfiguration() {
        return this.config.crm;
    }

    public getValidationConfiguration() {
        return this.config.validation;
    }

    public getUIConfiguration() {
        return this.config.ui;
    }
}
