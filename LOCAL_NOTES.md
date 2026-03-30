# Local notes - Process Migrator custom fix

## Issue fixed
Process Migrator failed with VS403734 when creating custom fields whose generated refname contained `@`.

Root cause:
The tool was sending the exported field `id` and `url` in the create-field payload.
Azure DevOps UI creates the same fields by sending a minimal payload with:
- `id = null`
- `url = null`

and lets the server generate the reference name.

## Files changed
- `src/common/Utilities.ts`
- `src/common/ProcessImporter.ts`

## Main change
Field creation payload was changed to mimic Azure DevOps UI field creation flow.

## Build
```bash
npm run build