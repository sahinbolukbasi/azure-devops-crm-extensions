import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { TimeEntry } from '../../domain/models/TimeEntry';
import { ICrmIntegrationService, CrmSubmissionResult } from '../../domain/services/TimeEntryService';

export interface CrmConfiguration {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
  resource: string;
}

export class CrmIntegrationService implements ICrmIntegrationService {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private readonly config: CrmConfiguration) {
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear it and retry
          this.accessToken = null;
          this.tokenExpiry = null;
          
          const token = await this.getAccessToken();
          if (token) {
            error.config.headers.Authorization = `Bearer ${token}`;
            return this.axiosInstance.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      // Check if current token is still valid
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Get new token from Azure AD
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/token`;
      
      const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        resource: this.config.resource
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = tokenResponse.data.access_token;
      const expiresIn = tokenResponse.data.expires_in;
      this.tokenExpiry = new Date(Date.now() + (expiresIn * 1000) - 60000); // 1 minute buffer

      return this.accessToken;
    } catch (error) {
      console.error('Token alma hatası:', error);
      return null;
    }
  }

  async validateCrmConnection(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/api/data/v9.2/WhoAmI');
      return response.status === 200;
    } catch (error) {
      console.error('CRM bağlantı doğrulama hatası:', error);
      return false;
    }
  }

  async submitTimeEntry(timeEntry: TimeEntry): Promise<CrmSubmissionResult> {
    try {
      const crmEntity = timeEntry.toCrmEntity();
      
      const response: AxiosResponse = await this.axiosInstance.post(
        '/api/data/v9.2/msdyn_timeentries',
        crmEntity
      );

      if (response.status === 204) {
        // Extract the created record ID from the response headers
        const location = response.headers['odata-entityid'] || response.headers['location'];
        const recordId = location ? this.extractRecordId(location) : undefined;

        return {
          success: true,
          crmRecordId: recordId || undefined
        };
      } else {
        return {
          success: false,
          errorMessage: `Beklenmeyen HTTP durumu: ${response.status}`
        };
      }
    } catch (error: any) {
      console.error('CRM zaman girişi gönderme hatası:', error);
      
      let errorMessage = 'CRM\'e zaman girişi gönderilirken hata oluştu';
      let errorDetails = error;

      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          errorMessage = 'Geçersiz veri: ' + this.extractErrorMessage(data);
        } else if (status === 401) {
          errorMessage = 'Yetkilendirme hatası: CRM\'e erişim izni yok';
        } else if (status === 403) {
          errorMessage = 'Erişim reddedildi: Gerekli izinler mevcut değil';
        } else if (status === 404) {
          errorMessage = 'CRM kaynağı bulunamadı';
        } else if (status >= 500) {
          errorMessage = 'CRM sunucu hatası';
        }
        
        errorDetails = data;
      } else if (error.request) {
        // Network error
        errorMessage = 'Ağ hatası: CRM\'e bağlanılamadı';
      }

      return {
        success: false,
        errorMessage,
        errorDetails
      };
    }
  }

  private extractRecordId(location: string): string | undefined {
    const match = location.match(/\(([^)]+)\)/);
    return match ? match[1] : undefined;
  }

  private extractErrorMessage(errorData: any): string {
    if (errorData?.error?.message) {
      return errorData.error.message;
    }
    
    if (errorData?.message) {
      return errorData.message;
    }
    
    if (typeof errorData === 'string') {
      return errorData;
    }
    
    return 'Bilinmeyen hata';
  }

  // Helper method to get lookup options
  async getProjects(): Promise<Array<{id: string, name: string}>> {
    try {
      const response = await this.axiosInstance.get(
        '/api/data/v9.2/msdyn_projects?$select=msdyn_projectid,msdyn_subject&$filter=statecode eq 0'
      );
      
      return response.data.value.map((project: any) => ({
        id: project.msdyn_projectid,
        name: project.msdyn_subject
      }));
    } catch (error) {
      console.error('Proje listesi alınırken hata:', error);
      return [];
    }
  }

  async getProjectTasks(projectId: string): Promise<Array<{id: string, name: string}>> {
    try {
      const response = await this.axiosInstance.get(
        `/api/data/v9.2/msdyn_projecttasks?$select=msdyn_projecttaskid,msdyn_subject&$filter=_msdyn_project_value eq ${projectId} and statecode eq 0`
      );
      
      return response.data.value.map((task: any) => ({
        id: task.msdyn_projecttaskid,
        name: task.msdyn_subject
      }));
    } catch (error) {
      console.error('Proje görev listesi alınırken hata:', error);
      return [];
    }
  }

  async getBookableResources(): Promise<Array<{id: string, name: string}>> {
    try {
      const response = await this.axiosInstance.get(
        '/api/data/v9.2/bookableresources?$select=bookableresourceid,name&$filter=statecode eq 0'
      );
      
      return response.data.value.map((resource: any) => ({
        id: resource.bookableresourceid,
        name: resource.name
      }));
    } catch (error) {
      console.error('Ayrılabilir kaynak listesi alınırken hata:', error);
      return [];
    }
  }
}
