# Gün 1 — Layihənin təməli

## Məqsəd

React + TypeScript admin panelini işə salmaq və lokal backend-ə həqiqi sorğu göndərmək.

## Anlamalı olduğun hissələr

1. `main.tsx` tətbiqi HTML-dəki root elementinə yerləşdirir. BrowserRouter URL-dən uyğun səhifəni seçməyə imkan verir.
2. `App.tsx` ortaq sidebar/header qurur. Outlet seçilmiş route-un səhifəsini həmin layout daxilində göstərir. Naməlum URL 404 səhifəsinə düşür.
3. `apiRequest<T>` sorğunu göndərir. `T` cavabın gözlənilən TypeScript tipidir, runtime validator deyil. Health ekranı əlavə olaraq `status === 'ok'` yoxlayır.
4. `credentials: 'include'` brauzerə backend sorğularında cookie göndərməyə imkan verir. Session-u sonrakı OTP taskında backend yaradacaq.
5. Fetch 400/401/409 kimi HTTP cavablarında avtomatik exception atmır. Buna görə `response.ok` yoxlanılır və `ApiError` statusu və server mesajını saxlayır.
6. Overview daxilində effect sorğunu başladır. AbortController səhifədən çıxanda sorğunu dayandırır. Timeout uzun müddət cavab gəlməyəndə istifadəçiyə xəta göstərir.
7. Check again `attempt` state-ini artırır, effect yeni sorğu göndərir. Server məlumatı UI-ın mənbəyidir.
8. `.env` Git-dən kənardadır, `.env.example` isə lazım olan konfiqurasiyanı sənədləşdirir. `VITE_` dəyişənləri frontend-də görünür.

## Review məşqi

- Backend sönük olsa UI-da nə baş verir?
- Fetch cavabında 401 gələrsə niyə özümüz xəta atırıq?
- `credentials` seçimini niyə hər komponentdə ayrı yazmırıq?
- TypeScript tipi niyə server cavabını runtime-da yoxlamır?
- Outlet nə edir və naməlum URL hara gedir?

## Növbəti gün

Login → OTP → session → protected route axını. Hər endpoint-in response formasını backend kodundan və real sorğudan yoxla.
