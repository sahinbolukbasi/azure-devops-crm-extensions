# Azure DevOps CRM Extension Test Rehberi

Bu rehber, Azure DevOps CRM Time Entry Extension'ınızı nasıl test edeceğinizi adım adım açıklar.

## 🧪 Test Türleri

### 1. Local Development Testing
### 2. Azure DevOps Test Organization
### 3. CRM Integration Testing
### 4. End-to-End Testing

---

## 🔧 1. Local Development Testing

### Gereksinimler
- Node.js 18+
- Azure DevOps Test Organization
- Microsoft Dynamics 365 CRM Test Environment

### Adım 1: Development Server Başlatma

```bash
# Development modunda çalıştır
npm run dev

# Ayrı terminal'de local server başlat
npx http-server dist -p 3000 --cors
```

### Adım 2: Browser'da Test

```bash
# Local test sayfası
open http://localhost:3000/time-entry-tab.html
```

---

## 🏢 2. Azure DevOps Test Organization

### Adım 1: Test Organization Oluşturma

1. [Azure DevOps](https://dev.azure.com) adresine gidin
2. Yeni organization oluşturun (örn: `test-crm-extension`)
3. Test projesi oluşturun

### Adım 2: Extension'ı Yükleme

#### Yöntem A: Private Extension (Önerilen)

```bash
# Publisher bilgilerini güncelleyin
# vss-extension.json dosyasında:
{
  "publisher": "your-test-publisher",
  "public": false
}

# Extension'ı yeniden paketleyin
npm run package
```

1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) adresine gidin
2. "New extension" → "Azure DevOps" seçin
3. VSIX dosyasını yükleyin
4. "Private" olarak işaretleyin
5. Test organization'ınızı "Share" edin

#### Yöntem B: Direct Upload (Development)

1. Azure DevOps → Organization Settings
2. Extensions → Browse Marketplace
3. "Upload extension" (sadece bazı organizasyonlarda mevcut)

### Adım 3: Extension'ı Etkinleştirme

1. Organization Settings → Extensions
2. Extension'ınızı bulun ve "Install" edin
3. Gerekli izinleri verin

---

## 🔗 3. CRM Integration Testing

### Adım 1: CRM Test Environment

#### Dynamics 365 Trial Oluşturma
1. [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. "Billing" → "Purchase services"
3. "Dynamics 365 Customer Service" trial başlatın

#### Azure AD App Registration
1. [Azure Portal](https://portal.azure.com) → Azure Active Directory
2. "App registrations" → "New registration"
3. Aşağıdaki ayarları yapın:

```json
{
  "name": "CRM-TimeEntry-Extension-Test",
  "supportedAccountTypes": "Single tenant",
  "redirectUri": "https://your-org.visualstudio.com"
}
```

4. "API permissions" ekleyin:
   - Dynamics CRM (user_impersonation)
   - Microsoft Graph (User.Read)

5. "Certificates & secrets" → Client secret oluşturun

### Adım 2: Environment Variables

`.env.test` dosyası oluşturun:

```bash
CRM_BASE_URL=https://your-org.crm.dynamics.com
CRM_CLIENT_ID=your-client-id
CRM_CLIENT_SECRET=your-client-secret
CRM_TENANT_ID=your-tenant-id
CRM_RESOURCE=https://your-org.crm.dynamics.com
```

### Adım 3: CRM Entity Hazırlığı

CRM'de gerekli custom field'ları oluşturun:

```sql
-- msdyn_timeentry entity'sine custom field'lar
new_calismayeri (Option Set):
- 100000000: Ofis
- 100000001: Ev
- 100000002: Müşteri Lokasyonu
- 100000003: Saha

new_fatura (Boolean):
- true: Evet
- false: Hayır

new_servistalebi (Lookup to incident)
new_ekaciklama (Multiple Lines of Text)
```

---

## 🧪 4. End-to-End Testing

### Test Senaryoları

#### Senaryo 1: Başarılı Zaman Girişi
```javascript
// Test data
const testData = {
  date: "2024-01-15",
  duration: 2.0,
  type: 192350000, // Work
  workLocation: 100000000, // Office
  projectId: "guid-of-test-project",
  projectTaskId: "guid-of-test-task",
  description: "Test zaman girişi açıklaması",
  billable: true,
  bookableResourceId: "guid-of-resource",
  ownerId: "guid-of-user"
};
```

#### Senaryo 2: Validation Hataları
- Boş zorunlu alanlar
- Geçersiz tarih (gelecek)
- Çok uzun açıklama
- Geçersiz GUID formatları

#### Senaryo 3: CRM Bağlantı Hataları
- Yanlış credentials
- Network timeout
- CRM service unavailable

### Test Adımları

1. **Azure DevOps'ta Work Item Açın**
   ```
   - Project → Work Items → New Work Item
   - "User Story" veya "Task" oluşturun
   - Work Item'ı açın
   ```

2. **Extension Tab'ını Kontrol Edin**
   ```
   - "Zaman Girişi" sekmesini görüyor musunuz?
   - Form yükleniyor mu?
   - Dropdown'lar doluyor mu?
   ```

3. **Form Validasyonunu Test Edin**
   ```
   - Boş form göndermeyi deneyin
   - Geçersiz tarih girin
   - Çok kısa açıklama yazın
   ```

4. **CRM Entegrasyonunu Test Edin**
   ```
   - Geçerli veri ile form doldurun
   - "CRM'e Gönder" butonuna tıklayın
   - Başarı mesajını kontrol edin
   ```

5. **CRM'de Veriyi Doğrulayın**
   ```
   - Dynamics 365'e gidin
   - Time Entries listesini kontrol edin
   - Gönderilen verinin doğruluğunu kontrol edin
   ```

---

## 🐛 Debug ve Troubleshooting

### Browser Developer Tools

```javascript
// Console'da debug için
console.log('Extension loaded:', window.SDK);
console.log('CRM config:', configService.getCrmConfiguration());

// Network tab'ında CRM API çağrılarını kontrol edin
// - Authentication requests
// - Time entry POST requests
// - Error responses
```

### Common Issues

#### 1. Extension Yüklenmiyor
```bash
# Manifest kontrolü
cat vss-extension.json | jq '.contributions'

# Build kontrolü
npm run build
ls -la dist/
```

#### 2. CRM Bağlantı Hatası
```bash
# Token test
curl -X POST "https://login.microsoftonline.com/{tenant-id}/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id={client-id}&client_secret={client-secret}&resource={crm-url}"
```

#### 3. Form Validation Hataları
```javascript
// Browser console'da
document.getElementById('timeEntryForm').checkValidity();
```

### Log Analizi

```javascript
// Extension log'ları
localStorage.getItem('crm-extension-logs');

// CRM API response'ları
sessionStorage.getItem('crm-api-responses');
```

---

## 📊 Test Checklist

### ✅ Functional Testing
- [ ] Extension tab görünüyor
- [ ] Form yükleniyor
- [ ] Dropdown'lar doluyor
- [ ] Validation çalışıyor
- [ ] CRM'e veri gönderiliyor
- [ ] Success/error mesajları gösteriliyor

### ✅ UI/UX Testing
- [ ] Türkçe metinler doğru
- [ ] Responsive design çalışıyor
- [ ] Loading states gösteriliyor
- [ ] Error states user-friendly

### ✅ Integration Testing
- [ ] Azure DevOps SDK entegrasyonu
- [ ] CRM API çağrıları
- [ ] Authentication flow
- [ ] Error handling

### ✅ Performance Testing
- [ ] Form yükleme hızı
- [ ] CRM API response time
- [ ] Memory usage
- [ ] Bundle size

---

## 🚀 Production Testing

### Staging Environment
1. Production benzeri CRM environment
2. Real user accounts
3. Actual project data
4. Network restrictions test

### User Acceptance Testing
1. End user'larla test
2. Real-world scenarios
3. Feedback collection
4. Performance monitoring

---

## 📝 Test Raporlama

### Test Results Template

```markdown
## Test Execution Report

**Date**: 2024-01-15
**Environment**: Azure DevOps Test Org
**CRM**: Dynamics 365 Trial

### Test Results
- ✅ Extension Installation: PASS
- ✅ Form Loading: PASS
- ❌ CRM Integration: FAIL (Authentication error)
- ✅ Validation: PASS

### Issues Found
1. CRM authentication timeout after 30 minutes
2. Project dropdown slow loading (>5 seconds)
3. Turkish character encoding issue in descriptions

### Next Steps
1. Fix authentication refresh token
2. Optimize project loading with pagination
3. Update character encoding configuration
```

Bu rehberi takip ederek extension'ınızı kapsamlı bir şekilde test edebilirsiniz. Hangi test türüyle başlamak istiyorsunuz?
