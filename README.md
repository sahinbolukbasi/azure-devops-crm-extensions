# Azure DevOps CRM Time Entry Extension

Bu extension, Azure DevOps Work Item Form'una özel bir sekme ekleyerek kullanıcıların zaman girişlerini Microsoft Dynamics 365 CRM sistemine göndermelerini sağlar.

## Özellikler

- **Work Item Entegrasyonu**: Azure DevOps Work Item Form'una "Zaman Girişi" sekmesi eklenir
- **CRM Entegrasyonu**: Microsoft Dynamics 365 CRM'deki `msdyn_timeentry` entity'sine veri gönderimi
- **Doğrulama**: Gerçek zamanlı form doğrulama ve iş kuralları kontrolü
- **Türkçe Arayüz**: Tamamen Türkçe kullanıcı arayüzü
- **Modern Mimari**: DDD, SOLID prensipleri ve Clean Code yaklaşımı

## Teknik Mimari

### Domain-Driven Design (DDD) Katmanları

```
src/
├── domain/
│   ├── models/           # Domain modelleri
│   └── services/         # Domain servisleri
├── infrastructure/
│   ├── crm/             # CRM entegrasyon servisleri
│   ├── validation/      # Doğrulama servisleri
│   └── repositories/    # Veri erişim katmanı
├── config/              # Konfigürasyon
└── time-entry-tab.*    # UI katmanı
```

### Temel Bileşenler

1. **TimeEntry Domain Model**: Zaman girişi iş kuralları ve validasyonları
2. **CrmIntegrationService**: Dynamics 365 CRM ile OAuth2 entegrasyonu
3. **TimeEntryValidationService**: İş kuralları ve veri doğrulama
4. **TimeEntryDomainService**: Ana iş mantığı koordinasyonu

## CRM Entity Alanları

Extension aşağıdaki CRM alanlarını destekler:

| Alan İsmi | Saha Adı | Veri Tipi | Zorunlu |
|-----------|----------|-----------|---------|
| Tarih | msdyn_date | Date | ✓ |
| Süre | msdyn_duration | Option Set | ✓ |
| Tür | msdyn_type | Option Set | ✓ |
| Çalışma Yeri | new_calismayeri | Option Set | ✓ |
| Proje | msdyn_project | Lookup | ✓ |
| Proje Görevi | msdyn_projecttask | Lookup | ✓ |
| Açıklama | msdyn_description | Text | ✓ |
| Faturalanacak mı? | new_fatura | Boolean | ✓ |
| Ayrılabilir Kaynak | msdyn_bookableresource | Lookup | ✓ |
| Sahip | ownerid | Lookup | ✓ |
| Servis Talebi | new_servistalebi | Lookup | - |
| Rol | msdyn_resourcecategory | Lookup | - |
| Ek Açıklama | new_ekaciklama | MultiText | - |

## Kurulum

### Gereksinimler

- Node.js 18+
- Azure DevOps organization
- Microsoft Dynamics 365 CRM instance
- Azure AD app registration

### Geliştirme Ortamı

1. **Bağımlılıkları yükleyin:**
```bash
npm install
```

2. **CRM konfigürasyonunu ayarlayın:**
```bash
# .env dosyası oluşturun
CRM_BASE_URL=https://your-org.crm.dynamics.com
CRM_CLIENT_ID=your-client-id
CRM_CLIENT_SECRET=your-client-secret
CRM_TENANT_ID=your-tenant-id
CRM_RESOURCE=https://your-org.crm.dynamics.com
```

3. **Extension'ı derleyin:**
```bash
npm run build
```

4. **Extension paketini oluşturun:**
```bash
npm run package
```

### Azure AD App Registration

1. Azure Portal'da yeni App Registration oluşturun
2. API permissions ekleyin:
   - Dynamics CRM (user_impersonation)
3. Client secret oluşturun
4. Redirect URI'ları yapılandırın

### CRM Konfigürasyonu

1. Dynamics 365 CRM'de gerekli security role'leri tanımlayın
2. `msdyn_timeentry` entity'sine erişim izinleri verin
3. Custom field'ları (`new_calismayeri`, `new_fatura`, vb.) oluşturun

## Kullanım

1. Azure DevOps'ta bir Work Item açın
2. "Zaman Girişi" sekmesine tıklayın
3. Gerekli alanları doldurun:
   - Tarih ve süre
   - Proje ve görev seçimi
   - Açıklama girişi
4. "CRM'e Gönder" butonuna tıklayın

## Doğrulama Kuralları

### Zorunlu Alanlar
- Tarih (gelecek tarih olamaz)
- Süre (15 dakika - 8 saat arası)
- Tür (Çalışma, Devamsızlık, İzin, Mola)
- Çalışma yeri
- Proje ve proje görevi
- Açıklama (minimum 3 karakter)
- Ayrılabilir kaynak
- Sahip

### İş Kuralları
- Maksimum günlük 12 saat
- 30 günden eski tarihler için uyarı
- Hafta sonu çalışması için uyarı
- Açıklama kalite kontrolü

## Geliştirme

### Kod Standartları

- **DDD**: Domain-driven design prensipleri
- **SOLID**: Single responsibility, Open/closed, vb.
- **Clean Code**: Okunabilir ve sürdürülebilir kod
- **TypeScript**: Tip güvenliği
- **ESLint**: Kod kalitesi

### Test

```bash
# Unit testleri çalıştır
npm test

# Coverage raporu
npm run test:coverage
```

### Debug

```bash
# Development modunda çalıştır
npm run dev
```

## Deployment

1. Extension'ı Azure DevOps Marketplace'e yükleyin
2. Organization'da extension'ı etkinleştirin
3. CRM connection string'lerini yapılandırın

## Sorun Giderme

### Yaygın Hatalar

1. **CRM Bağlantı Hatası**
   - Client ID/Secret kontrolü
   - Tenant ID doğrulaması
   - API permissions kontrolü

2. **Validation Hataları**
   - GUID format kontrolü
   - Zorunlu alan kontrolü
   - İş kuralları kontrolü

3. **UI Sorunları**
   - Browser console logları
   - Network tab kontrolü
   - Extension manifest kontrolü

### Log Analizi

Browser developer tools'da console loglarını kontrol edin:
- CRM API çağrıları
- Validation sonuçları
- Error detayları

## Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun
3. Commit'lerinizi yapın
4. Pull request gönderin

## Lisans

MIT License - Detaylar için LICENSE dosyasına bakın.

## İletişim

- GitHub Issues: Hata raporları ve özellik istekleri
- Email: [sahinbolukbasii@gmail.com]

## Changelog

### v1.0.0
- İlk sürüm
- Temel CRM entegrasyonu
- Türkçe UI
- DDD mimarisi
- Real-time validation
