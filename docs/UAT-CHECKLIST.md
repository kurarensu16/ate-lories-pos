# Pilot UAT and Release Checklist

## Pilot Functional Checks

- [ ] Launch desktop app from installer on clean Windows machine
- [ ] Login using local admin credentials
- [ ] Create, edit, disable, and delete menu items
- [ ] Mark items as today's menu and validate POS display
- [ ] Process cash/card order and verify payment completion
- [ ] View order history and update status (active/completed/cancelled)
- [ ] Verify dashboard and reports render from local SQLite data

## Data Safety Checks

- [ ] Run integrity check from Settings > System
- [ ] Create manual backup file from app
- [ ] Restore from backup and verify order/menu data consistency
- [ ] Confirm app restarts with persisted data

## Packaging and Upgrade Checks

- [ ] Build Windows installer with `npm run dist:win`
- [ ] Install over previous version without deleting user data
- [ ] Confirm database file remains intact after update
- [ ] Smoke test login, POS order, and reports post-upgrade

## Rollback Plan

- Keep latest backup before each release deployment.
- If regression occurs, reinstall previous stable installer and restore latest backup file.
- Capture failure notes and affected workflow before retrying rollout.
