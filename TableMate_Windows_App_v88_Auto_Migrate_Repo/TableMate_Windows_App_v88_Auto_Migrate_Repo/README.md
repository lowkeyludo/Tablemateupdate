# TableMate Windows App v88 Auto Migrate

This repo builds TableMate into a Windows Electron app.

## Previous computer data

This version keeps the same app identity:

```text
appId: com.tablemate.bookings
productName: TableMate Bookings
```

If the previous Windows app was installed on the same computer with the same identity, bookings should load from the same local app storage automatically.

It also adds a backup/migration bridge:

- saves a live backup to `Documents\TableMate\Backups\tablemate-auto-backup.json`
- if the app starts with no bookings, it searches `Documents\TableMate` for previous TableMate export/backup JSON files
- imports previous bookings, waiters, tables, sections, rules, blacklist and error log if found

## Selfies

Selfie files stay here:

```text
Documents\TableMate\Selfies
```

Existing selfie files are not deleted.

## Autosave folders

```text
Documents\TableMate\Selfies
Documents\TableMate\Reports\Date Booking Sheets
Documents\TableMate\Reports\Kitchen Eisbein Lists
Documents\TableMate\Reports\Day End Reports
Documents\TableMate\Reports\CSV Exports
Documents\TableMate\Reports\PDF Reports
Documents\TableMate\Downloads
Documents\TableMate\Backups
```

## GitHub upload

Best method:

1. Extract the ZIP.
2. Open `TableMate_Windows_App_v88_Auto_Migrate_Repo`.
3. Upload the CONTENTS of that folder to GitHub.

If you upload the whole folder by mistake, the YAML still tries to find it.

## Artifact name

```text
TableMate_Windows_v88_Auto_Migrate_Release
```
