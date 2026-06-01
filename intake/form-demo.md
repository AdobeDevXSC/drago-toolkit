---
title: Form block demo
description: Test page for the multi-section form block sourced from the contact-form sheet.
template: document
---

# Contact us

Use this page to validate the form block. The block loads field definitions from the linked sheet JSON and renders an accessible HTML form with Spectrum 2 styling.

| Form |
| --- |
| [/intake/contact-form.json](/intake/contact-form.json) |

## What this exercises

- Multi-section layout with right-side section nav and mobile stepper
- Section validation on Next, checkmarks for completed sections, and submit when all sections validate
- Text, email, tel, textarea, select, radio, checkbox, and toggle fields
- Required markers and help text
- Conditional visibility (`phoneDetail` when contact method is Phone)
- Submit button styling and client-side validation (submission deferred until an endpoint is linked)
