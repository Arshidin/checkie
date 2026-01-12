# Railway Deployment History & Troubleshooting Log

> Этот файл содержит историю проблем и решений при деплое на Railway.
> Claude должен прочитать этот файл перед работой с деплоем.

---

## Timeline

### День 1-2 (10-12 января 2026)

#### Проблема 1: Custom Start Command сбрасывается
**Симптомы:**
- В Railway UI Custom Start Command постоянно возвращается к `npx prisma migrate deploy && npm run start:prod`
- После каждого деплоя настройки сбрасываются

**Неправильные попытки (НЕ ПОВТОРЯТЬ!):**
- ❌ Изменение Start Command в Railway UI → НЕ РАБОТАЕТ, сбрасывается
- ❌ Удаление Custom Start Command → НЕ РАБОТАЕТ, возвращается
- ❌ Многократные редеплои с теми же настройками

**Корневая причина:**
- Файл `railway.toml` в репозитории ПЕРЕОПРЕДЕЛЯЕТ все настройки из Railway UI
- Railway читает этот файл при каждом деплое

**Решение:**
```toml
# checkie-backend/railway.toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "node dist/main"
```

**Урок:** Всегда проверять конфигурационные файлы в репозитории (`railway.toml`, `railway.json`, `nixpacks.toml`) перед изменением UI настроек.

---

#### Проблема 2: NestJS Dependency Injection Error
**Симптомы:**
```
Nest can't resolve dependencies of the SubscriptionsService (PrismaService, WebhooksService, ?, ?).
Please make sure that the argument BalanceService at index [2] is available in the SubscriptionsModule context.
```

**Причина:** `SubscriptionsModule` не импортировал `BalanceModule` и `ProvidersModule`

**Решение:**
```typescript
// checkie-backend/src/modules/subscriptions/subscriptions.module.ts
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => WebhooksModule),
    BalanceModule,      // ДОБАВЛЕНО
    ProvidersModule,    // ДОБАВЛЕНО
  ],
  ...
})
```

---

#### Проблема 3: BullMQ Redis ETIMEDOUT
**Симптомы:**
```
Error: connect ETIMEDOUT
[BullMQ] at TCPConnectWrap.afterConnect
```
- Приложение стартует успешно
- PostgreSQL подключается
- BullMQ не может подключиться к Redis

**Первая гипотеза (НЕВЕРНАЯ!):**
- ❌ "Railway public Redis endpoint требует TLS"
- ❌ Добавили `...(isProduction && { tls: {} })` → ETIMEDOUT с TLSSocket

**Корневая причина:**
- Railway public Redis URL (`redis://...railway.app:6379`) использует **TCP proxy**
- TCP proxy работает по **plain TCP, БЕЗ TLS**
- TLS нужен ТОЛЬКО для URLs с протоколом `rediss://` (два 's')

**Неправильные попытки (НЕ ПОВТОРЯТЬ!):**
- ❌ `...(isProduction && { tls: {} })` → ETIMEDOUT на TLSSocket
- ❌ Автоматический TLS для production → таймаут

**Решение:**
```typescript
// checkie-backend/src/app.module.ts - BullMQ config
// ТОЛЬКО rediss:// протокол требует TLS, НЕ isProduction!
const useTls = parsed.protocol === 'rediss:';
return {
  connection: {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    connectTimeout: 30000,
    ...(useTls && { tls: {} }),
  },
};

// checkie-backend/src/modules/redis/redis.module.ts - ioredis config
const useTls = url.startsWith('rediss://');
return new Redis(url, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  ...(useTls && { tls: {} }),
});
```

**Статус:** ❌ Не решило проблему. ETIMEDOUT сохранялся.

---

#### Проблема 3.1: ETIMEDOUT сохраняется без TLS
**Симптомы:**
- После удаления TLS ошибка ETIMEDOUT всё ещё появляется
- Public Redis URL (`redis-production-c4b9.up.railway.app`) недоступен из backend

**Корневая причина:**
- Railway сервисы в одном проекте должны общаться через **internal networking**
- Public URL работает только для внешнего доступа, не для inter-service communication

**Решение (ФИНАЛЬНОЕ ✅):**
```
# Вместо public URL:
redis://default:password@redis-production-c4b9.up.railway.app:6379

# Использовать internal URL:
redis://default:password@redis.railway.internal:6379
```

**Как найти internal hostname:**
1. Railway Dashboard → Redis service → Settings → Networking
2. Найти `RAILWAY_PRIVATE_DOMAIN` = `redis.railway.internal`

**Статус:** ✅ РЕШЕНО 12 января 2026. Приложение успешно стартует.

---

## Текущая конфигурация Railway

### Environment Variables (обязательные)
| Variable | Описание | Статус |
|----------|----------|--------|
| DATABASE_URL | PostgreSQL connection string | ✅ Из Railway PostgreSQL |
| REDIS_URL | Redis connection string | ✅ Internal URL (`redis.railway.internal`) |
| JWT_SECRET | JWT signing key | ✅ Установлен |
| ENCRYPTION_KEY | 32+ символов для AES-256 | ✅ Установлен |
| NODE_ENV | production | ✅ Установлен |
| PORT | 3000 (или Railway порт) | ✅ Railway устанавливает автоматически |
| ALLOWED_ORIGINS | https://checkiepay.netlify.app | ✅ Установлен |

### Файлы конфигурации
| Файл | Назначение |
|------|------------|
| `railway.toml` | Build & deploy настройки |
| `Dockerfile` | Multi-stage production build |

---

## Чеклист перед деплоем

1. [ ] Проверить `railway.toml` - не переопределяет ли нужные настройки
2. [ ] Проверить все imports в NestJS модулях
3. [ ] REDIS_URL использует internal hostname (`redis.railway.internal`), НЕ public URL
4. [ ] Проверить что все env variables установлены в Railway

---

## Известные особенности Railway

1. **railway.toml переопределяет UI** - всегда проверять этот файл первым
2. **Internal networking для inter-service** - сервисы должны общаться через `*.railway.internal`
3. **TLS только для rediss:// URLs** - проверять протокол, НЕ environment
4. **PORT устанавливается Railway** - не хардкодить
5. **Build logs доступны только во время билда** - после завершения показываются только Deploy logs
6. **Public URLs для внешнего доступа** - НЕ для communication между сервисами в одном проекте

---

*Последнее обновление: 12 января 2026*
