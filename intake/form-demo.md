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
| [Submit endpoint](https://hook.fusion.adobe.com/0kcbtq67fawhez2i2dirnpffmby1hhil) |

## What this exercises

- Multi-section layout with right-side section nav and mobile stepper
- Section validation on Next, section POST on Next, checkmarks for completed sections, and final submit with `formComplete`
- Text, email, tel, textarea, select, radio, checkbox, and toggle fields
- Required markers and help text
- Conditional visibility (`phoneDetail` when contact method is Phone)
- Submit button styling, Fusion webhook POST on Next/submit, and redirect to thank-you on completion
