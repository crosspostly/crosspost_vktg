# TODO: VK→Telegram Crossposter Improvements (актуально только то, что ниже)

## P1 (критичное)
- [ ] Enhanced ID Format Support (server.gs)
  - [ ] Поддержка коротких ссылок vk.cc (resolve → реальный id)
  - [ ] Invite-ссылки TG (разрешение/валидация)
  - [ ] Валидация существования группы/чата (VK/TG) через API
  - [ ] Уведомления/ошибки для невалидных ссылок/нет доступа
- [ ] Comprehensive Error Handling (server.gs)
  - [ ] logApiCall со всеми HTTP-body/headers/status (категории VK_API/TG_API/SYSTEM/USER)
  - [ ] retryApiCall (экспоненциальный bekoff для временных ошибок)
  - [ ] Graceful degrade
- [ ] UX для ручного включения разрешений ScriptApp: см. todo_clients_permissions.gs (client.gs UI, не appsscript.json)

## P2 (высокий)
- [ ] Group/Channel Name Display (client + server)
  - [ ] Автообновление и кеш имён, error/status в интерфейсе
  - [ ] Warnings, если токены недействительны (бот не в чате/VK токен no access) — UI индикация

## P3+ (средний/низкий, только полезные коды оставить!)
- [ ] testUrlExtraction(), testNameRetrieval(), testApiWrappers()
- [ ] Лучшие cheat utility-фрагменты (ultra-short regex для Vk/Tg extraction, cache clear, id normalization)

---

# Удали всё лишнее из папки, кроме нужных code-фрагментов выше и реально полезных шаблонов. Документацию о старых/закрытых задачах и устаревшие .md удалить!

**Чеклист:**
- [ ] В to_fix/ остаётся только обновленный файл (этот README/todo+cheatcodes `.gs`, `.txt` — если есть).
- [ ] Всё старое и устаревшее стереть: документация и todo для уже внедренных задач удаляются.
