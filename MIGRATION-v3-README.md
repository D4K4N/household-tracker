# Database Migration v2 → v3

## ⚠️ IMPORTANT - READ BEFORE UPDATING

### What This Update Does

This update evolves your household tracker into a full water meter reading system with:
- Separate water meter locations (for grouped meters)
- Individual water meters with billing history
- Configurable billing rates
- Bill printing
- Enhanced data management

### 🔒 Your Data is SAFE

**CRITICAL:** This migration PRESERVES all your existing data:
- ✅ All household pins stay exactly where they are
- ✅ All GPS coordinates unchanged
- ✅ All household names, addresses, notes preserved
- ✅ All routes preserved
- ✅ NO re-pinning required

### What Happens When You Update

1. Database upgrades from v2 to v3 (automatic)
2. New stores added for water meters and billing
3. Existing households get new optional fields added
4. If a household has a meter number, a water meter record is automatically created
5. Default settings are initialized

### Before You Update

**STRONGLY RECOMMENDED:**
1. Go to menu → Export Backup
2. Save the backup file somewhere safe
3. Then update the app

### After Update

You should see in console:
```
🔄 Upgrading database from v2 to v3
✅ Water Meter Locations store created
✅ Water Meters store created  
✅ Billing Records store created
✅ Migration complete: [X] households enhanced, [Y] meters created
```

Your map will still show all your existing household pins!

### What's New

**New Features Available:**
- Add physical water meter locations (+ METER LOCATION button)
- Manage multiple meters at one location
- Record meter readings with automatic previous reading
- Calculate bills automatically
- View billing history per meter
- Print individual bills
- Enhanced search for meters
- Configurable billing rates in Settings

### If Something Goes Wrong

1. Don't panic - your data is in IndexedDB
2. Import your backup file (menu → Import Backup)
3. Report the issue with console errors

### Migration is Idempotent

You can reload the page multiple times - the migration only runs once.
It checks migrationMetadata store to avoid duplicate migrations.

### Technical Details

**New IndexedDB Stores:**
- `waterMeterLocations` - Physical meter sites
- `waterMeters` - Individual meters
- `billingRecords` - Monthly readings and bills
- `settings` - Configurable rates and rules
- `migrationMetadata` - Migration tracking

**Existing Stores (PRESERVED):**
- `households` - All your field data (UNTOUCHED except new fields added)
- `routes` - All your recorded routes (UNTOUCHED)

---

## Ready to Update?

1. Export backup first!
2. Push changes to GitHub
3. Open app on phone
4. Check console logs
5. Verify all household pins visible
6. Test new features

**Questions?** Check the migration logs in browser console (F12).
